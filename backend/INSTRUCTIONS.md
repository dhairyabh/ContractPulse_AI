# ML Connection & RAG Implementation Guide

This folder contains the backend prototype for your specific responsibility: **Connecting ML predicted risk to relevant contract evidence** using RAG (Retrieval-Augmented Generation) with PostgreSQL and `pgvector`.

## What was implemented

1.  **`database.py`**: Sets up the PostgreSQL connection using SQLAlchemy and defines the `ContractClause` table with a `pgvector` embedding column.
2.  **`main.py`**: A FastAPI application exposing:
    *   `POST /api/ml/connect-evidence`: This is your main endpoint. It takes the predicted risk from the ML model, converts it to an embedding via OpenAI, and searches the `pgvector` database for the most relevant contract clauses (Evidence) using cosine similarity.
    *   `POST /api/documents/add-clause`: A utility endpoint to add and embed contract clauses into the database for testing.
3.  **`requirements.txt`**: Lists all the Python dependencies.
4.  **`.env.example`**: Shows the required environment variables.

## What YOU need to do explicitly to run and test this:

### 1. Prerequisites
You need a PostgreSQL database with the `pgvector` extension installed.
If you are using Docker, you can quickly spin one up:
```bash
docker run --name pgvector-db -e POSTGRES_PASSWORD=password -e POSTGRES_DB=contractpulse -p 5432:5432 -d pgvector/pgvector:pg16
```

### 2. Environment Setup
Navigate to the backend directory:
```bash
cd backend
```
Create a virtual environment and install dependencies:
```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

Copy the `.env.example` to `.env` and fill in your keys:
```bash
cp .env.example .env
```
*   Set `OPENAI_API_KEY` to your actual OpenAI API key (or replace the embedding logic in `main.py` if using a different ML embedding model like HuggingFace).
*   Set `DATABASE_URL` to match your PostgreSQL instance.

### 3. Run the Service
Start the FastAPI server:
```bash
uvicorn main:app --reload
```
You can view the interactive API documentation at: `http://localhost:8000/docs`

### 4. How to Test Your Flow
1.  **Add Evidence (Suhani's Document processing output):**
    Use the `/api/documents/add-clause` endpoint in the Swagger UI to insert some dummy contract clauses.
    ```json
    {
      "document_id": "DOC-123",
      "clause_text": "If the environmental permit is delayed by more than 15 days, the contractor is entitled to a deadline extension without financial penalty."
    }
    ```
2.  **Connect ML Risk (Your Main Task):**
    Use the `/api/ml/connect-evidence` endpoint to simulate your ML model sending a risk prediction.
    ```json
    {
      "project_id": "CP-2048",
      "risk_type": "Schedule slippage",
      "risk_description": "Permit approval lag. Environmental review is 23 days behind baseline.",
      "risk_score": 78.0
    }
    ```
    *The API will return the relevant clause you added in step 1, successfully linking the ML risk to the contract evidence!*
