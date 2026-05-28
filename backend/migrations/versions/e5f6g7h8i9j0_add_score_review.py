"""add_score_review

Revision ID: e5f6g7h8i9j0
Revises: d4e5f6g7h8i9
Create Date: 2026-05-26 21:05:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'e5f6g7h8i9j0'
down_revision: Union[str, Sequence[str], None] = 'd4e5f6g7h8i9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('scores') as batch_op:
        batch_op.add_column(sa.Column('review_status', sa.String(20), nullable=True))
        batch_op.add_column(sa.Column('reviewed_by', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('reviewed_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('review_detail_scores', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('review_comment', sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('scores') as batch_op:
        batch_op.drop_column('review_comment')
        batch_op.drop_column('review_detail_scores')
        batch_op.drop_column('reviewed_at')
        batch_op.drop_column('reviewed_by')
        batch_op.drop_column('review_status')
