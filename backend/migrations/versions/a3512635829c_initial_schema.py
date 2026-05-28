"""initial_schema

Revision ID: a3512635829c
Revises:
Create Date: 2026-05-26 19:12:35.022642

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a3512635829c'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('users',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('username', sa.String(length=50), nullable=False),
    sa.Column('password_hash', sa.String(length=255), nullable=False),
    sa.Column('role', sa.String(length=10), nullable=False),
    sa.Column('display_name', sa.String(length=50), nullable=False),
    sa.Column('student_id', sa.String(length=30), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_users_username', 'users', ['username'], unique=True)
    op.create_index('ix_users_id', 'users', ['id'], unique=False)

    op.create_table('cases',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('case_data', sa.JSON(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_cases_id', 'cases', ['id'], unique=False)

    op.create_table('training_records',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('case_id', sa.Integer(), nullable=False),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('start_time', sa.DateTime(), nullable=True),
    sa.Column('end_time', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['case_id'], ['cases.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_training_records_id', 'training_records', ['id'], unique=False)
    op.create_index('ix_tr_user_status', 'training_records', ['user_id', 'status'], unique=False)
    op.create_index('ix_tr_status', 'training_records', ['status'], unique=False)

    op.create_table('messages',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('record_id', sa.Integer(), nullable=False),
    sa.Column('role', sa.String(length=10), nullable=False),
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['record_id'], ['training_records.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_msg_record_created', 'messages', ['record_id', 'created_at'], unique=False)
    op.create_index('ix_messages_id', 'messages', ['id'], unique=False)

    op.create_table('scores',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('record_id', sa.Integer(), nullable=False),
    sa.Column('total_score', sa.Float(), nullable=False),
    sa.Column('detail_scores', sa.JSON(), nullable=True),
    sa.Column('strengths', sa.JSON(), nullable=True),
    sa.Column('weaknesses', sa.JSON(), nullable=True),
    sa.Column('missed_content', sa.JSON(), nullable=True),
    sa.Column('suggestions', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['record_id'], ['training_records.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('record_id')
    )
    op.create_index('ix_scores_id', 'scores', ['id'], unique=False)

    op.create_table('notes',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('record_id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['record_id'], ['training_records.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_notes_id', 'notes', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_notes_id', table_name='notes')
    op.drop_table('notes')
    op.drop_index('ix_scores_id', table_name='scores')
    op.drop_table('scores')
    op.drop_index('ix_messages_id', table_name='messages')
    op.drop_index('ix_msg_record_created', table_name='messages')
    op.drop_table('messages')
    op.drop_index('ix_tr_status', table_name='training_records')
    op.drop_index('ix_tr_user_status', table_name='training_records')
    op.drop_index('ix_training_records_id', table_name='training_records')
    op.drop_table('training_records')
    op.drop_index('ix_cases_id', table_name='cases')
    op.drop_table('cases')
    op.drop_index('ix_users_id', table_name='users')
    op.drop_index('ix_users_username', table_name='users')
    op.drop_table('users')
