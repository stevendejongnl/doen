class DoenError(Exception):
    """Base for all domain exceptions."""


class NotFoundError(DoenError):
    def __init__(self, resource: str, id: str) -> None:
        super().__init__(f"{resource} '{id}' not found")
        self.resource = resource
        self.id = id


class AlreadyExistsError(DoenError):
    def __init__(self, detail: str) -> None:
        super().__init__(detail)


class AccessDeniedError(DoenError):
    def __init__(self, detail: str = "Access denied") -> None:
        super().__init__(detail)


class InvalidCredentialsError(DoenError):
    def __init__(self) -> None:
        super().__init__("Invalid credentials")


class InvalidTokenError(DoenError):
    def __init__(self, detail: str = "Invalid token") -> None:
        super().__init__(detail)


class ConflictError(DoenError):
    def __init__(self, detail: str) -> None:
        super().__init__(detail)


class InvitationExpiredError(DoenError):
    def __init__(self) -> None:
        super().__init__("Invitation has expired")


class InvitationAlreadyAcceptedError(DoenError):
    def __init__(self) -> None:
        super().__init__("Invitation has already been accepted")


class InvitationEmailMismatchError(DoenError):
    def __init__(self) -> None:
        super().__init__("Invitation email does not match the authenticated user")
