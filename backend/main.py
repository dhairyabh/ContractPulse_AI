import os
from fastapi import FastAPI, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List
import openai
from dotenv import load_dotenv
from database import get_db, ContractClause, init_db

load_dotenv()

app = FastAPI(title="ContractPulse AI - ML & Evidence Service")

openai.api_key = os.getenv("OPENAI_API_KEY")

class RiskPrediction(BaseModel):
    project_id: str
    risk_type: str
    risk_description: str
    risk_score: float

class EvidenceResponse(BaseModel):
    clause_id: int
    document_id: str
    clause_text: str
    similarity_score: float

@app.on_event("startup")
def on_startup():
    init_db()
    # Execute SQL to ensure pgvector extension is created
    from database import engine
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        conn.commit()

def get_embedding(text_to_embed: str) -> List[float]:
    try:
        response = openai.embeddings.create(
            input=text_to_embed,
            model="text-embedding-ada-002"
        )
        return response.data[0].embedding
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Embedding generation failed: {str(e)}")

@app.post("/api/ml/connect-evidence", response_model=List[EvidenceResponse])
def connect_risk_to_evidence(risk: RiskPrediction, db: Session = Depends(get_db)):
    """
    Main Logic: Takes ML predicted risk and connects it to contract evidence.
    """
    # 1. Generate embedding for the predicted risk description
    # We embed the description of the risk to find semantically similar contract clauses.
    search_query = f"Risk: {risk.risk_type}. Description: {risk.risk_description}"
    query_embedding = get_embedding(search_query)
    
    # 2. Search pgvector database for the most relevant contract clauses (Evidence)
    # Using L2 distance (<->) or Cosine similarity (<=>)
    try:
        # Retrieve the top 3 most relevant clauses
        results = db.query(
            ContractClause,
            ContractClause.embedding.cosine_distance(query_embedding).label("distance")
        ).order_by(
            ContractClause.embedding.cosine_distance(query_embedding)
        ).limit(3).all()
        
        evidence_list = []
        for clause, distance in results:
            evidence_list.append(EvidenceResponse(
                clause_id=clause.id,
                document_id=clause.document_id,
                clause_text=clause.clause_text,
                similarity_score=1.0 - float(distance) # Convert distance to similarity score
            ))
            
        return evidence_list
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database search failed: {str(e)}")

# A utility endpoint to add contract clauses for testing
class ClauseInput(BaseModel):
    document_id: str
    clause_text: str

@app.post("/api/documents/add-clause")
def add_clause(clause: ClauseInput, db: Session = Depends(get_db)):
    embedding = get_embedding(clause.clause_text)
    db_clause = ContractClause(
        document_id=clause.document_id,
        clause_text=clause.clause_text,
        embedding=embedding
    )
    db.add(db_clause)
    db.commit()
    db.refresh(db_clause)
    return {"message": "Clause added successfully", "clause_id": db_clause.id}
