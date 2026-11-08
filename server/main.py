from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from db.database import test_db_connection
from routes.users.user_routes import router as user_router
from controllers.auth_controller import router as auth_router
from routes.categories.category_routes import router as category_router
from routes.transactions.transaction_routes import router as transaction_router
from routes.budgets.budget_routes import router as budget_router
from routes.audit_logs.audit_log_routes import router as audit_log_router
from routes.dashboard.dashboard_routes import router as dashboard_router
from routes.password_reset.password_reset_routes import router as password_reset_router

app = FastAPI(title="SpendWise")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
):
    return JSONResponse(
        status_code=400,
        content={
            "status": "FAILED",
            "message": "Invalid request body. Encrypted fields are required.",
        },
    )


@app.get("/")
def home():
    return {"message": "Welcome to SpendWise API"}


# database connection
@app.get("/db-test")
def db_test():
    return test_db_connection()


# Register User API
app.include_router(user_router)
app.include_router(auth_router)
# Category
app.include_router(category_router)
app.include_router(transaction_router)
app.include_router(budget_router)
# dashboard
app.include_router(dashboard_router)
app.include_router(audit_log_router)
app.include_router(password_reset_router)
