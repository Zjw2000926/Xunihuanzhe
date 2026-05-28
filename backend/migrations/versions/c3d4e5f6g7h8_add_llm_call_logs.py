"""add_llm_call_logs

Revision ID: c3d4e5f6g7h8
Revises: b2c3d4e5f6g7
Create Date: 2026-05-26 20:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'c3d4e5f6g7h8'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6g7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('llm_call_logs',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=True),
    sa.Column('record_id', sa.Integer(), nullable=True),
    sa.Column('case_id', sa.Integer(), nullable=True),
    sa.Column('purpose', sa.String(40), nullable=False),
    sa.Column('provider', sa.String(40), nullable=False, server_default='deepseek'),
    sa.Column('model', sa.String(80), nullable=False),
    sa.Column('temperature', sa.Float(), nullable=True),
    sa.Column('max_tokens', sa.Integer(), nullable=True),
    sa.Column('prompt_tokens', sa.Integer(), nullable=True),
    sa.Column('completion_tokens', sa.Integer(), nullable=True),
    sa.Column('total_tokens', sa.Integer(), nullable=True),
    sa.Column('token_estimated', sa.Integer(), nullable=False, server_default='1'),
    sa.Column('estimated_cost', sa.Float(), nullable=True),
    sa.Column('cost_currency', sa.String(10), nullable=True, server_default='CNY'),
    sa.Column('latency_ms', sa.Integer(), nullable=True),
    sa.Column('status', sa.String(20), nullable=False),
    sa.Column('error_type', sa.String(80), nullable=True),
    sa.Column('error_message', sa.Text(), nullable=True),
    sa.Column('request_chars', sa.Integer(), nullable=True),
    sa.Column('response_chars', sa.Integer(), nullable=True),
    sa.Column('meta', sa.JSON(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['case_id'], ['cases.id'], ),
    sa.ForeignKeyConstraint(['record_id'], ['training_records.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_llm_call_logs_id', 'llm_call_logs', ['id'], unique=False)
    op.create_index('ix_llm_call_logs_purpose', 'llm_call_logs', ['purpose'], unique=False)
    op.create_index('ix_llm_call_logs_status', 'llm_call_logs', ['status'], unique=False)
    op.create_index('ix_llm_call_logs_created_at', 'llm_call_logs', ['created_at'], unique=False)
    op.create_index('ix_llm_call_logs_user_id', 'llm_call_logs', ['user_id'], unique=False)
    op.create_index('ix_llm_call_logs_record_id', 'llm_call_logs', ['record_id'], unique=False)
    op.create_index('ix_llm_call_logs_case_id', 'llm_call_logs', ['case_id'], unique=False)
    op.create_index('ix_llm_call_logs_latency_ms', 'llm_call_logs', ['latency_ms'], unique=False)
    op.create_index('ix_llm_call_logs_error_type', 'llm_call_logs', ['error_type'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_llm_call_logs_error_type', table_name='llm_call_logs')
    op.drop_index('ix_llm_call_logs_latency_ms', table_name='llm_call_logs')
    op.drop_index('ix_llm_call_logs_case_id', table_name='llm_call_logs')
    op.drop_index('ix_llm_call_logs_record_id', table_name='llm_call_logs')
    op.drop_index('ix_llm_call_logs_user_id', table_name='llm_call_logs')
    op.drop_index('ix_llm_call_logs_created_at', table_name='llm_call_logs')
    op.drop_index('ix_llm_call_logs_status', table_name='llm_call_logs')
    op.drop_index('ix_llm_call_logs_purpose', table_name='llm_call_logs')
    op.drop_index('ix_llm_call_logs_id', table_name='llm_call_logs')
    op.drop_table('llm_call_logs')
