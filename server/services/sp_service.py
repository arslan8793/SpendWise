from db.database import get_db_connection


def execute_stored_procedure(procedure_name: str, parameters: list):
    connection = None
    cursor = None
    result_cursors = []

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        # Execute the stored procedure.
        output_parameters = cursor.callproc(procedure_name, parameters)
        # Collect result sets.
        result_sets = []

        for result_cursor in cursor.stored_results():
            result_cursors.append(result_cursor)

            columns = [column[0] for column in result_cursor.description]
            rows = result_cursor.fetchall()

            result_sets.append([dict(zip(columns, row)) for row in rows])

        # Read stored procedure OUT parameters.
        status = str(output_parameters[-3]).upper()
        message = output_parameters[-2]
        record_id = output_parameters[-1]

        print("status", status)

        # Commit successful operations; rollback failed ones.
        if status in ("S", "SUCCESS"):
            connection.commit()
        else:
            connection.rollback()

        return {
            "status": output_parameters[-3],
            "message": message,
            "id": record_id,
            "data": result_sets,
        }

    except Exception:
        if connection is not None and connection.is_connected():
            connection.rollback()
        raise

    finally:
        for result_cursor in result_cursors:
            result_cursor.close()

        if cursor is not None:
            cursor.close()

        if connection is not None and connection.is_connected():
            connection.close()
