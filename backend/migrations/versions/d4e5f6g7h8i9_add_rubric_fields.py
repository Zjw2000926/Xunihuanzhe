"""add_rubric_fields

Revision ID: d4e5f6g7h8i9
Revises: c3d4e5f6g7h8
Create Date: 2026-05-26 21:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'd4e5f6g7h8i9'
down_revision: Union[str, Sequence[str], None] = 'c3d4e5f6g7h8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('scores') as batch_op:
        batch_op.add_column(sa.Column('rubric_version', sa.String(40), nullable=True))
        batch_op.add_column(sa.Column('model_name', sa.String(80), nullable=True))
        batch_op.add_column(sa.Column('prompt_version', sa.Integer(), nullable=True, server_default='1'))
        batch_op.add_column(sa.Column('score_scale', sa.Integer(), nullable=True, server_default='100'))

    # 旧数据回填：标记为旧版 100 分制
    op.execute("UPDATE scores SET rubric_version = 'legacy_100', score_scale = 100 WHERE rubric_version IS NULL")


def downgrade() -> None:
    with op.batch_alter_table('scores') as batch_op:
        batch_op.drop_column('score_scale')
        batch_op.drop_column('prompt_version')
        batch_op.drop_column('model_name')
        batch_op.drop_column('rubric_version')
