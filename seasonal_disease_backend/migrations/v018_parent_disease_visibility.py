"""Persist dynamic Parent disease visibility and its append-only audit."""

from __future__ import annotations

from sqlalchemy import Connection, Engine, inspect

from app.models import ParentDiseaseVisibilityAudit, ParentDiseaseVisibilitySetting


def _upgrade(connection: Connection) -> None:
    # Deliberately do not seed the singleton. A missing row is the explicit
    # first-use state: version 0 with every manifest disease enabled.
    ParentDiseaseVisibilitySetting.__table__.create(connection, checkfirst=True)
    ParentDiseaseVisibilityAudit.__table__.create(connection, checkfirst=True)


def upgrade(bind: Engine | Connection) -> None:
    if isinstance(bind, Connection):
        _upgrade(bind)
        return
    with bind.begin() as connection:
        _upgrade(connection)


def downgrade(bind: Engine | Connection) -> None:
    connection = bind if isinstance(bind, Connection) else bind.connect()
    owns = not isinstance(bind, Connection)
    try:
        tables = set(inspect(connection).get_table_names())
        if "parent_disease_visibility_audits" in tables:
            ParentDiseaseVisibilityAudit.__table__.drop(connection)
        if "parent_disease_visibility_settings" in tables:
            ParentDiseaseVisibilitySetting.__table__.drop(connection)
        if owns:
            connection.commit()
    finally:
        if owns:
            connection.close()
