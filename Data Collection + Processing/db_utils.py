import os
from pathlib import Path
from datetime import date, datetime
import hashlib
import json

import pandas as pd
import psycopg2
from psycopg2 import sql
from psycopg2.extras import execute_values


def _get_database_url() -> str:
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        return database_url

    # Local fallback: read DATABASE_URL from .env next to this file.
    env_path = Path(__file__).with_name(".env")
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            if key.strip() == "DATABASE_URL" and value.strip():
                database_url = value.strip().strip('"').strip("'")
                os.environ["DATABASE_URL"] = database_url
                return database_url

    if not database_url:
        raise RuntimeError("Missing DATABASE_URL environment variable")
    return database_url


def _normalize_cell_value(value):
    if value is None or pd.isna(value):
        return None
    if isinstance(value, pd.Timestamp):
        return str(value)
    if isinstance(value, (datetime, date)):
        return str(value)
    if isinstance(value, (dict, list, tuple, set)):
        return json.dumps(value, ensure_ascii=False)
    return value


def load_table(table_name: str) -> pd.DataFrame:
    database_url = _get_database_url()
    query = sql.SQL("SELECT * FROM {};").format(sql.Identifier(table_name))

    with psycopg2.connect(database_url) as conn:
        return pd.read_sql_query(query.as_string(conn), conn)


def load_query(query: str) -> pd.DataFrame:
    database_url = _get_database_url()
    with psycopg2.connect(database_url) as conn:
        return pd.read_sql_query(query, conn)


def _unique_index_name(table_name: str, unique_cols: list[str]) -> str:
    fingerprint = f"{table_name}|{','.join(unique_cols)}".encode("utf-8")
    digest = hashlib.md5(fingerprint).hexdigest()[:12]
    base = f"ux_{table_name}_{digest}"
    return base[:63]


def _ensure_unique_index(cur, table_name: str, unique_cols: list[str]) -> None:
    if not unique_cols:
        return

    index_name = _unique_index_name(table_name, unique_cols)
    create_index_query = sql.SQL(
        "CREATE UNIQUE INDEX IF NOT EXISTS {} ON {} ({})"
    ).format(
        sql.Identifier(index_name),
        sql.Identifier(table_name),
        sql.SQL(", ").join(sql.Identifier(col) for col in unique_cols),
    )
    cur.execute(create_index_query)


def save_dataframe(df: pd.DataFrame, table_name: str, unique_cols: list[str]) -> int:
    if df is None or df.empty:
        return 0

    if not unique_cols:
        raise ValueError("unique_cols must not be empty")

    database_url = _get_database_url()
    df = df.copy()
    columns = list(df.columns)

    records = [
        tuple(_normalize_cell_value(value) for value in row)
        for row in df.itertuples(index=False, name=None)
    ]

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

            # If the table already exists, the UNIQUE constraint above is not added.
            # Ensure there is a matching unique index for ON CONFLICT.
            _ensure_unique_index(cur, table_name, unique_cols)

            update_cols = [col for col in columns if col not in unique_cols]

            if not update_cols:
                insert_query = sql.SQL(
                    """
                    INSERT INTO {} ({}) VALUES %s
                    ON CONFLICT ({}) DO NOTHING
                    """
                ).format(
                    sql.Identifier(table_name),
                    sql.SQL(", ").join(sql.Identifier(col) for col in columns),
                    unique_defs
                )
            else:
                update_defs = sql.SQL(", ").join(
                    sql.SQL("{} = EXCLUDED.{}").format(sql.Identifier(col), sql.Identifier(col))
                    for col in update_cols
                )

                where_clause = sql.SQL(" OR ").join(
                    sql.SQL("{}.{} IS DISTINCT FROM EXCLUDED.{}").format(
                        sql.Identifier(table_name), sql.Identifier(col), sql.Identifier(col)
                    )
                    for col in update_cols
                )

                insert_query = sql.SQL(
                    """
                    INSERT INTO {} ({}) VALUES %s
                    ON CONFLICT ({}) DO UPDATE SET {}
                    WHERE {}
                    """
                ).format(
                    sql.Identifier(table_name),
                    sql.SQL(", ").join(sql.Identifier(col) for col in columns),
                    unique_defs,
                    update_defs,
                    where_clause
                )

            execute_values(cur, insert_query.as_string(cur), records, page_size=500)

            # Number of rows inserted in the last statement.
            return cur.rowcount if cur.rowcount is not None else 0
