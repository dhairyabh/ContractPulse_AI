import os
from sqlalchemy import create_engine, Column, Integer, String, Text
from sqlalchemy.orm import sessionmaker, declarative_base
from pgvector.sqlalchemy import Vector
from dotenv import load_dotenv

load_dotenv()

# Example: postgresql://user:password@localhost/dbname
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost/contractpulse")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class ContractClause(Base):
    __tablename__ = "contract_clauses"
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(String, index=True)
    clause_text = Column(Text)
    # Using 1536 dimensions for OpenAI embeddings
    embedding = Column(Vector(1536))
    
def init_db():
    # In a real app, use Alembic for migrations, but for this MVP we create it directly
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
