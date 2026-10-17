"""Demo data. Run: python -m app.seed

Candidates go through the same create_candidate / move_stage functions as the API,
so every history row exists and the demo funnel is correct.
"""
from datetime import timedelta

from sqlalchemy import select

from app.config import settings
from app.database import SessionLocal
from app.models import User, utcnow
from app.routes.candidates import create_candidate, move_stage
from app.security import hash_password

S, I, O, H, R = "Screening", "Interview", "Offer", "Hired", "Rejected"
PEOPLE = [  # name, role, skills, source, stages visited after Applied
    ("Asha Rao", "Backend Engineer", "Python, FastAPI, SQL", "Referral", [S, I, O, H]),
    ("Vikram Shah", "Frontend Engineer", "React, CSS, Vite", "LinkedIn", [S, I, O]),
    ("Meera Iyer", "Data Analyst", "SQL, Excel, Tableau", "Job board", [S, I]),
    ("Rohan Das", "QA Engineer", "Selenium, Pytest", "Career site", [S, R]),
    ("Priya Nair", "Product Designer", "Figma, Research", "Referral", [S, I, O, H]),
    ("Arjun Mehta", "DevOps Engineer", "AWS, Linux, CI/CD", "LinkedIn", []),
    ("Sneha Kulkarni", "Backend Engineer", "Java, Spring Boot", "Job board", [S]),
    ("Karan Malhotra", "Frontend Engineer", "JavaScript, React", "Agency", [S, I, R]),
    ("Divya Reddy", "Data Scientist", "Python, Pandas, ML", "Career site", [S, I]),
    ("Imran Sheikh", "Support Engineer", "Troubleshooting, SQL", "Referral", []),
    ("Lakshmi Pillai", "Product Manager", "Roadmaps, Analytics", "LinkedIn", [S, I, O]),
    ("Tarun Gupta", "Backend Engineer", "Python, PostgreSQL", "Job board", [S]),
    ("Neha Joshi", "UX Researcher", "Interviews, Surveys", "Agency", []),
    ("Sanjay Verma", "Full-stack Engineer", "React, Python, Docker", "Referral", [S, I, O, H]),
]


def backdate(db, candidate, i: int) -> None:
    """Spread history over past days so average days per stage are realistic."""
    db.refresh(candidate)
    rows = list(candidate.history)
    gaps = [1 + (i + k) % 4 for k in range(len(rows) - 1)]
    moment = utcnow() - timedelta(days=sum(gaps) + 1 + i % 3)
    for k, row in enumerate(rows):
        row.changed_at = moment
        if k < len(gaps):
            moment += timedelta(days=gaps[k])
    candidate.created_at = rows[0].changed_at
    db.commit()


def main() -> None:
    if not settings.DEMO_PASSWORD:
        raise SystemExit("Set DEMO_PASSWORD in backend/.env before seeding.")
    with SessionLocal() as db:
        demo_email = settings.DEMO_EMAIL.strip().lower()  # emails are stored lower case
        if db.scalar(select(User.id).where(User.email == demo_email)):
            raise SystemExit("Already seeded (demo user exists).")
        user = User(name="Demo Recruiter", email=demo_email, active=True,
                    password_hash=hash_password(settings.DEMO_PASSWORD))
        db.add(user)
        db.commit()
        for i, (name, role, skills, source, path) in enumerate(PEOPLE):
            data = {"name": name, "email": name.lower().replace(" ", ".") + "@example.com",
                    "phone": f"+91 98765 {10000 + i}", "role": role, "skills": skills, "source": source}
            candidate = create_candidate(db, data, user.id)
            for stage in path:
                move_stage(db, candidate, stage, user.id)
            backdate(db, candidate, i)
        print(f"Seeded {len(PEOPLE)} candidates. Log in as {demo_email}.")


if __name__ == "__main__":
    main()
