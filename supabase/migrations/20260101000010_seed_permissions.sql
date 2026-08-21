-- Seed the global permission catalog for the modules that exist today.
-- Future modules (HR/FINANCE/PRODUCTION) will add their own rows in their
-- own migrations when those modules are actually built.
insert into public.permissions (key, module_key, resource, action, description) values
  ('IT.TICKETS.VIEW',    'IT', 'TICKETS', 'VIEW',    'View all tickets in the company'),
  ('IT.TICKETS.CREATE',  'IT', 'TICKETS', 'CREATE',  'Create a new ticket'),
  ('IT.TICKETS.UPDATE',  'IT', 'TICKETS', 'UPDATE',  'Edit ticket fields'),
  ('IT.TICKETS.DELETE',  'IT', 'TICKETS', 'DELETE',  'Delete a ticket'),
  ('IT.TICKETS.ASSIGN',  'IT', 'TICKETS', 'ASSIGN',  'Assign or reassign a technician'),
  ('IT.TICKETS.COMMENT', 'IT', 'TICKETS', 'COMMENT', 'Comment on a ticket'),
  ('IT.TICKETS.RESOLVE', 'IT', 'TICKETS', 'RESOLVE', 'Mark a ticket resolved'),
  ('IT.TICKETS.CLOSE',   'IT', 'TICKETS', 'CLOSE',   'Close a ticket'),

  ('ADMIN.USERS.VIEW',              'ADMIN', 'USERS',           'VIEW',    'View company users'),
  ('ADMIN.USERS.MANAGE',            'ADMIN', 'USERS',           'MANAGE',  'Create, disable, and assign roles to users'),
  ('ADMIN.ROLES.MANAGE',            'ADMIN', 'ROLES',           'MANAGE',  'Create custom roles and edit role permissions'),
  ('ADMIN.DEPARTMENTS.MANAGE',      'ADMIN', 'DEPARTMENTS',     'MANAGE',  'Create and edit departments'),
  ('ADMIN.IT_CATEGORIES.MANAGE',    'ADMIN', 'IT_CATEGORIES',   'MANAGE',  'Configure IT ticket categories/subcategories'),
  ('ADMIN.COMPANY_SETTINGS.MANAGE', 'ADMIN', 'COMPANY_SETTINGS','MANAGE',  'Edit company profile and settings'),
  ('ADMIN.AUDIT.VIEW',              'ADMIN', 'AUDIT',           'VIEW',    'View the company audit log');
