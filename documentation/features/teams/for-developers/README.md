# Teams (for developers)

The teams feature provides a way to group users and manage their membership. This document describes the technical
details of the teams feature.

## Backend implementation

The backend implementation for teams is located in the `backend/team` module.

### REST API

The teams feature provides several REST endpoints for managing teams and their members.

* `GET /api/v1/team`: List all teams.
* `GET /api/v1/team/{key}`: Get the details of a specific team.
* `POST /api/v1/team`: Create a new team.
* `PUT /api/v1/team/{key}`: Update an existing team.
* `DELETE /api/v1/team/{key}`: Delete a team.
* `GET /api/v1/team/{teamKey}/user`: List all users in a team.
* `POST /api/v1/team/{teamKey}/user`: Add a user to a team.
* `DELETE /api/v1/team/{teamKey}/user/{username}`: Remove a user from a team.
* `GET /api/v1/team/{teamKey}/candidate-user`: Get candidate users to add to a team.

### Integration with access control

Teams are integrated into Valtimo's access control system as a resource. The resource type for teams is
`com.ritense.team.domain.Team`.

### Database schema

The teams feature uses two tables:

* `team`: Stores information about teams (key and title).
* `team_user`: Stores the membership information (team key and username).

## Frontend implementation

The frontend implementation for teams is located in the `frontend/projects/valtimo/teams` library.

### Module

The `TeamsModule` should be imported into the application to use the teams feature.

### Routing

The teams feature provides several routes for managing teams and their members:

* `/teams`: List all teams.
* `/teams/:teamKey`: Team details and member management.
