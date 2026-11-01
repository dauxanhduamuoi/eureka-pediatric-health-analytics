from pydantic import BaseModel, Field, field_validator


class PasswordPayload(BaseModel):
    password: str = Field(min_length=6)

    @field_validator('password')
    @classmethod
    def password_bytes(cls, value):
        if len(value.encode('utf-8')) > 72:
            raise ValueError('Mật khẩu vượt quá giới hạn 72 byte.')
        return value


class CreateUserPayload(PasswordPayload):
    username: str = Field(min_length=1, max_length=100)
    full_name: str | None = Field(default=None, max_length=255)
    role: str = 'staff'
    position: str | None = Field(default=None, max_length=100)
    permissions: list[str] = Field(default_factory=list)

    @field_validator('username', 'full_name', 'position')
    @classmethod
    def trim_fields(cls, value):
        if value is not None:
            value = value.strip()
            if not value: raise ValueError('Thông tin không được chỉ chứa khoảng trắng.')
        return value


class RevisionPayload(BaseModel):
    expected_revision: str | None = Field(default=None, pattern=r'^[a-f0-9]{64}$')


class UpdateRolePayload(RevisionPayload):
    role: str


class UpdateActivePayload(RevisionPayload):
    is_active: bool = Field(strict=True)


class UpdatePermissionsPayload(RevisionPayload):
    permissions: list[str]


class ResetPasswordPayload(PasswordPayload, RevisionPayload):
    pass


class BulkCreateUsersPayload(PasswordPayload):
    username_prefix: str = Field(min_length=1, max_length=97)
    count: int = Field(ge=1, le=500, strict=True)
    role: str = 'staff'
    permissions: list[str] = Field(min_length=1)
    full_name_prefix: str | None = Field(default=None, max_length=251)
    position: str | None = Field(default=None, max_length=100)

    @field_validator('username_prefix', 'full_name_prefix', 'position')
    @classmethod
    def trim_fields(cls, value):
        return CreateUserPayload.trim_fields(value)
