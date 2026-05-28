"""add_scoring_status

Revision ID: b2c3d4e5f6g7
Revises: a3512635829c
Create Date: 2026-05-26 19:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'b2c3d4e5f6g7'
down_revision: Union[str, Sequence[str], None] = 'a3512635829c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('training_records') as batch_op:
        batch_op.add_column(sa.Column('scoring_status', sa.String(20), nullable=True))
        batch_op.add_column(sa.Column('scoring_error', sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('training_records') as batch_op:
        batch_op.drop_column('scoring_error')
        batch_op.drop_column('scoring_status')
