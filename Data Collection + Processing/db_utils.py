import os

import pandas as pd
import psycopg2
from psycopg2 import sql
from psycopg2.extras import execute_values


def _get_database_url() -> str:
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("Missing DATABASE_URL environment variable")
    return database_url


def save_dataframe(df: pd.DataFrame, table_name: str, unique_cols: list[str]) -> int:
    if df is None or df.empty:
        return 0

    if not unique_cols:
        raise ValueError("unique_cols must not be empty")

    database_url = _get_database_url()
    df = df.copy()
    records = df.where(pd.notna(df), None).to_records(index=False).tolist()
    columns = list(df.columns)

    with psycopg2.connect(database_url) as conn:
        with conn.cursor() as cur:
            col_defs = sql.SQL(", ").join(
                sql.SQL("{} TEXT").format(sql.Identifier(col)) for col in columns
            )
            unique_defs = sql.SQL(", ").join(sql.Identifier(col) for col in unique_cols)

            create_table_query = sql.SQL(
                """
                CREATE TABLE IF NOT EXISTS {} (
                    {},
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    UNIQUE ({})
                )
                """
            ).format(sql.Identifier(table_name), col_defs, unique_defs)
            cur.execute(create_table_query)

            insert_query = sql.SQL(
                """
                INSERT INTO {} ({}) VALUES %s
                ON CONFLICT ({}) DO NOTHING
                """
            ).format(
                sql.Identifier(table_name),
                sql.SQL(", ").join(sql.Identifier(col) for col in columns),
                unique_defs,
            )

            execute_values(cur, insert_query.as_string(cur), records, page_size=500)

            # Number of rows inserted in the last statement.
            return cur.rowcount if cur.rowcount is not None else 0
