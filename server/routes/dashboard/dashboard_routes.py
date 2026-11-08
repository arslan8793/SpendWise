from fastapi import APIRouter, Depends, HTTPException, Query
from mysql.connector import Error
from db.database import get_db_connection
from utils.auth_dependencies import get_current_user
from datetime import date

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


# =========================================================
# Helper: Apply role-based user filtering
# =========================================================
def apply_user_scope(query, parameters, current_user, user_id=None):
    # Regular users: always see their own data.
    # Admins: see all users' data, or a specific user's data.
    is_admin = str(current_user.get("role_code", "")).upper() == "ADMIN"

    if is_admin:
        if user_id is not None:
            query += " AND USER_ID = %s"
            parameters.append(user_id)
    else:
        query += " AND USER_ID = %s"
        parameters.append(current_user["user_id"])

    return query, parameters


# =========================================================
# 1. Monthly Summary
# =========================================================
@router.get("/monthlySummary")
def get_dashboard_summary(
    year: int | None = Query(default=None, ge=2000, le=9999),
    month: int | None = Query(default=None, ge=1, le=12),
    user_id: int | None = Query(default=None, gt=0),
    current_user: dict = Depends(get_current_user),
):
    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        query = """
            SELECT
                TRANSACTION_YEAR,
                TRANSACTION_MONTH,
                SUM(TOTAL_INCOME) AS TOTAL_INCOME,
                SUM(TOTAL_EXPENSES) AS TOTAL_EXPENSES,
                SUM(NET_BALANCE) AS NET_BALANCE
            FROM vw_spend_monthly_summary
            WHERE 1 = 1
        """

        parameters = []

        query, parameters = apply_user_scope(query, parameters, current_user, user_id)

        if year is not None:
            query += " AND TRANSACTION_YEAR = %s"
            parameters.append(year)

        if month is not None:
            query += " AND TRANSACTION_MONTH = %s"
            parameters.append(month)

        query += """
            GROUP BY TRANSACTION_YEAR, TRANSACTION_MONTH
            ORDER BY TRANSACTION_YEAR DESC, TRANSACTION_MONTH DESC
        """

        cursor.execute(query, tuple(parameters))
        summaries = cursor.fetchall()

        data = [
            {
                "year": summary["TRANSACTION_YEAR"],
                "month": summary["TRANSACTION_MONTH"],
                "total_income": float(summary["TOTAL_INCOME"] or 0),
                "total_expenses": float(summary["TOTAL_EXPENSES"] or 0),
                "net_balance": float(summary["NET_BALANCE"] or 0),
            }
            for summary in summaries
        ]

        if year is not None and month is not None:
            data = (
                data[0]
                if data
                else {
                    "year": year,
                    "month": month,
                    "total_income": 0.0,
                    "total_expenses": 0.0,
                    "net_balance": 0.0,
                }
            )

        return {
            "status": "SUCCESS",
            "message": "Dashboard summary retrieved successfully",
            "data": data,
        }

    except Error as e:
        print(f"Dashboard summary database error: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve dashboard summary",
        )

    finally:
        if cursor is not None:
            cursor.close()

        if connection is not None and connection.is_connected():
            connection.close()


# =========================================================
# 2. Category Expense Breakdown
# =========================================================
@router.get("/categoryExpenseBreakdown")
def categoryExpenseBreakdown(
    year: int | None = Query(default=None, ge=2000, le=9999),
    month: int | None = Query(default=None, ge=1, le=12),
    user_id: int | None = Query(default=None, gt=0),
    current_user: dict = Depends(get_current_user),
):
    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        query = """
            SELECT
                CATEGORY_ID,
                CATEGORY_NAME,
                TRANSACTION_YEAR,
                TRANSACTION_MONTH,
                SUM(TOTAL_EXPENSES) AS TOTAL_EXPENSES,
                SUM(TRANSACTION_COUNT) AS TRANSACTION_COUNT
            FROM vw_spend_category_expenses
            WHERE 1 = 1
        """

        parameters = []

        query, parameters = apply_user_scope(query, parameters, current_user, user_id)

        if year is not None:
            query += " AND TRANSACTION_YEAR = %s"
            parameters.append(year)

        if month is not None:
            query += " AND TRANSACTION_MONTH = %s"
            parameters.append(month)

        query += """
            GROUP BY
                CATEGORY_ID,
                CATEGORY_NAME,
                TRANSACTION_YEAR,
                TRANSACTION_MONTH
            ORDER BY
                TRANSACTION_YEAR DESC,
                TRANSACTION_MONTH DESC,
                TOTAL_EXPENSES DESC
        """

        cursor.execute(query, tuple(parameters))
        summaries = cursor.fetchall()

        data = [
            {
                "category_id": summary["CATEGORY_ID"],
                "category_name": summary["CATEGORY_NAME"],
                "year": summary["TRANSACTION_YEAR"],
                "month": summary["TRANSACTION_MONTH"],
                "total_expenses": float(summary["TOTAL_EXPENSES"] or 0),
                "transaction_count": int(summary["TRANSACTION_COUNT"] or 0),
            }
            for summary in summaries
        ]

        return {
            "status": "SUCCESS",
            "message": "Category expense breakdown retrieved successfully",
            "data": data,
        }

    except Error as e:
        print(f"Category expense breakdown database error: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve category expense breakdown",
        )

    finally:
        if cursor is not None:
            cursor.close()

        if connection is not None and connection.is_connected():
            connection.close()


# =========================================================
# 3. Budget Utilization
# =========================================================
@router.get("/budgetUtilization")
def budgetUtilization(
    year: int | None = Query(default=None, ge=2000, le=9999),
    month: int | None = Query(default=None, ge=1, le=12),
    user_id: int | None = Query(default=None, gt=0),
    current_user: dict = Depends(get_current_user),
):
    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        query = """
            SELECT
                USER_ID,
                BUDGET_ID,
                CATEGORY_ID,
                CATEGORY_NAME,
                BUDGET_MONTH,
                BUDGET_YEAR,
                BUDGET_AMOUNT,
                ACTUAL_EXPENSES,
                REMAINING_BUDGET,
                UTILIZATION_PERCENTAGE
            FROM vw_spend_budget_utilization
            WHERE 1 = 1
        """

        parameters = []

        query, parameters = apply_user_scope(query, parameters, current_user, user_id)

        if year is not None:
            query += " AND BUDGET_YEAR = %s"
            parameters.append(year)

        if month is not None:
            query += " AND BUDGET_MONTH = %s"
            parameters.append(month)

        query += """
            ORDER BY
                BUDGET_YEAR DESC,
                BUDGET_MONTH DESC,
                CATEGORY_NAME ASC
        """

        cursor.execute(query, tuple(parameters))
        summaries = cursor.fetchall()

        data = [
            {
                "user_id": summary["USER_ID"],
                "budget_id": summary["BUDGET_ID"],
                "category_id": summary["CATEGORY_ID"],
                "category_name": summary["CATEGORY_NAME"],
                "month": summary["BUDGET_MONTH"],
                "year": summary["BUDGET_YEAR"],
                "budget_amount": float(summary["BUDGET_AMOUNT"] or 0),
                "actual_expenses": float(summary["ACTUAL_EXPENSES"] or 0),
                "remaining_budget": float(summary["REMAINING_BUDGET"] or 0),
                "utilization_percentage": float(summary["UTILIZATION_PERCENTAGE"] or 0),
            }
            for summary in summaries
        ]

        return {
            "status": "SUCCESS",
            "message": "Budget utilization retrieved successfully",
            "data": data,
        }

    except Error as e:
        print(f"Budget utilization database error: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve budget utilization",
        )

    finally:
        if cursor is not None:
            cursor.close()

        if connection is not None and connection.is_connected():
            connection.close()


# =========================================================
# 4. Transaction Report
# =========================================================
@router.get("/transactionReport")
def transactionReport(
    year: int | None = Query(default=None, ge=2000, le=9999),
    month: int | None = Query(default=None, ge=1, le=12),
    category_id: int | None = Query(default=None, gt=0),
    transaction_type: str | None = Query(
        default=None,
        pattern="^(INCOME|EXPENSE)$",
    ),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    enable_flag: str = Query(
        default="Y",
        pattern="^(Y|N|ALL)$",
    ),
    user_id: int | None = Query(default=None, gt=0),
    current_user: dict = Depends(get_current_user),
):
    connection = None
    cursor = None

    if start_date is not None and end_date is not None:
        if start_date > end_date:
            raise HTTPException(
                status_code=400,
                detail="Start date cannot be after end date",
            )

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        query = """
                    SELECT
                T.TRANSACTION_ID,
                T.USER_ID,
                U.EMAIL AS USER_EMAIL,
                T.CATEGORY_ID,
                T.CATEGORY_NAME,
                T.TRANSACTION_TYPE,
                T.AMOUNT,
                T.TRANSACTION_DATE,
                T.DESCRIPTION,
                T.PAYMENT_MODE,
                T.ENABLE_FLAG
            FROM vw_spend_transaction_report T
            LEFT JOIN SPEND_USERS U
                ON U.USER_ID = T.USER_ID
            WHERE 1 = 1
                """

        parameters = []

        # query, parameters = apply_user_scope(query, parameters, current_user, user_id)
        is_admin = str(current_user.get("role_code", "")).upper() == "ADMIN"

        if is_admin:
            if user_id is not None:
                query += " AND T.USER_ID = %s"
                parameters.append(user_id)
        else:
            query += " AND T.USER_ID = %s"
            parameters.append(current_user["user_id"])

        if year is not None:
            query += " AND YEAR(T.TRANSACTION_DATE) = %s"
            parameters.append(year)

        if month is not None:
            query += " AND MONTH(T.TRANSACTION_DATE) = %s"
            parameters.append(month)

        if category_id is not None:
            query += " AND T.CATEGORY_ID = %s"
            parameters.append(category_id)

        if transaction_type is not None:
            query += " AND T.TRANSACTION_TYPE = %s"
            parameters.append(transaction_type)

        if enable_flag != "ALL":
            query += " AND T.ENABLE_FLAG = %s"
            parameters.append(enable_flag)

        if start_date is not None:
            query += " AND T.TRANSACTION_DATE >= %s"
            parameters.append(start_date)

        if end_date is not None:
            query += " AND T.TRANSACTION_DATE < DATE_ADD(%s, INTERVAL 1 DAY)"
            parameters.append(end_date)

        query += """
            ORDER BY T.TRANSACTION_DATE DESC, T.TRANSACTION_ID DESC
        """
        cursor.execute(query, tuple(parameters))
        transactions = cursor.fetchall()

        data = [
            {
                key.lower(): (
                    float(value)
                    if key == "AMOUNT"
                    else (
                        value.isoformat(sep=" ")
                        if key
                        in (
                            "TRANSACTION_DATE",
                            "CREATION_DATE",
                            "LAST_UPDATE_DATE",
                        )
                        and value is not None
                        else value
                    )
                )
                for key, value in transaction.items()
            }
            for transaction in transactions
        ]

        return {
            "status": "SUCCESS",
            "message": "Transaction report retrieved successfully",
            "data": data,
        }

    except Error as e:
        print(f"Transaction report database error: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve transaction report",
        )

    finally:
        if cursor is not None:
            cursor.close()

        if connection is not None and connection.is_connected():
            connection.close()


# =========================================================
# 5. Admin Analytics
# Existing admin dashboard endpoint
# =========================================================
@router.get("/adminAnalytics")
def get_admin_analytics(
    current_user: dict = Depends(get_current_user),
):
    # Admin-only authorization
    if str(current_user.get("role_code", "")).upper() != "ADMIN":
        raise HTTPException(
            status_code=403,
            detail="Admin access required",
        )

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        # 1. User statistics
        cursor.execute("""
            SELECT
                COUNT(*) AS total_users,
                COALESCE(SUM(
                    CASE WHEN ENABLE_FLAG = 'Y'
                    THEN 1 ELSE 0 END
                ), 0) AS active_users,
                COALESCE(SUM(
                    CASE WHEN ENABLE_FLAG = 'N'
                    THEN 1 ELSE 0 END
                ), 0) AS inactive_users
            FROM SPEND_USERS
        """)

        user_stats = cursor.fetchone()

        # 2. Overall transaction statistics
        cursor.execute("""
            SELECT
                COUNT(*) AS total_transactions,
                COALESCE(SUM(
                    CASE
                        WHEN UPPER(TRANSACTION_TYPE) = 'INCOME'
                        THEN AMOUNT ELSE 0
                    END
                ), 0) AS total_income,
                COALESCE(SUM(
                    CASE
                        WHEN UPPER(TRANSACTION_TYPE) = 'EXPENSE'
                        THEN AMOUNT ELSE 0
                    END
                ), 0) AS total_expenses
            FROM SPEND_TRANSACTIONS
            WHERE ENABLE_FLAG = 'Y'
        """)

        transaction_stats = cursor.fetchone()

        # 3. Monthly income vs expenses for the last 6 months
        cursor.execute("""
            SELECT
                YEAR(TRANSACTION_DATE) AS year,
                MONTH(TRANSACTION_DATE) AS month,
                DATE_FORMAT(TRANSACTION_DATE, '%b %Y') AS month_label,
                COALESCE(SUM(
                    CASE
                        WHEN UPPER(TRANSACTION_TYPE) = 'INCOME'
                        THEN AMOUNT ELSE 0
                    END
                ), 0) AS total_income,
                COALESCE(SUM(
                    CASE
                        WHEN UPPER(TRANSACTION_TYPE) = 'EXPENSE'
                        THEN AMOUNT ELSE 0
                    END
                ), 0) AS total_expenses
            FROM SPEND_TRANSACTIONS
            WHERE ENABLE_FLAG = 'Y'
              AND TRANSACTION_DATE >=
                  DATE_FORMAT(
                      DATE_SUB(CURDATE(), INTERVAL 5 MONTH),
                      '%Y-%m-01'
                  )
              AND TRANSACTION_DATE < DATE_ADD(
                  LAST_DAY(CURDATE()),
                  INTERVAL 1 DAY
              )
            GROUP BY
                YEAR(TRANSACTION_DATE),
                MONTH(TRANSACTION_DATE),
                DATE_FORMAT(TRANSACTION_DATE, '%b %Y')
            ORDER BY year, month
        """)

        monthly_stats = cursor.fetchall()

        return {
            "status": "SUCCESS",
            "message": "Admin analytics retrieved successfully",
            "data": {
                "users": {
                    "total": int(user_stats["total_users"]),
                    "active": int(user_stats["active_users"]),
                    "inactive": int(user_stats["inactive_users"]),
                },
                "transactions": {
                    "total": int(transaction_stats["total_transactions"]),
                    "income": float(transaction_stats["total_income"]),
                    "expenses": float(transaction_stats["total_expenses"]),
                },
                "monthly": [
                    {
                        "year": int(row["year"]),
                        "month": int(row["month"]),
                        "month_label": row["month_label"],
                        "total_income": float(row["total_income"]),
                        "total_expenses": float(row["total_expenses"]),
                    }
                    for row in monthly_stats
                ],
            },
        }

    except Error as e:
        print(f"Admin analytics database error: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve admin analytics",
        )

    finally:
        if cursor is not None:
            cursor.close()

        if connection is not None and connection.is_connected():
            connection.close()
