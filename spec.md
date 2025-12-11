# System Goal
A growth tracker to manage our organic business growth in our advertising agency. Client service people will view and update this tracker continuously and it needs to be made user-friendly and simple that when a growth opportunity is identified from a client this can be added to the system.

The system will need rules and behaviour so that leads are managed through a pipeline from start to finish. Key characteristics of the lead will be captured and managed.

# Core features
- Capture lead details through a simple interface
- Setup the lead goals - when, how much, likelihood
- View existing leads and update them daily
- Management reports - leads, by client, by month, by status
- MS Teams and email notifications for updates and key changes in status
- **Multi-User Environment**: Multiple client service people can login and manage their own leads.
- **Personalized Dashboard**: Users see a home screen with their current leads upon login.

# Authentication & Users
- **Primary Auth**: Okta SSO via Intranet link.
- **Mechanism**: Users arrive with an encrypted JWT token containing details (email, name).
- **Fallback**: Email/Password login (legacy/admin).
- **User Provisioning**: Auto-create user if they don't exist upon valid SSO login.
- Leads are associated with the user who created them.
- "My Leads" view shows only leads owned by the logged-in user.

# Acceptance
When we are able to initiate new leads and track and manage them through a pipeline to sales, and the team feel supported by the system to help them perform their role.
