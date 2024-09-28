"""add label column

Revision ID: add_label_column
Revises: 
Create Date: 2024-09-28 09:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_label_column'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('images', sa.Column('label', sa.String(), nullable=True))

def downgrade():
    op.drop_column('images', 'label')