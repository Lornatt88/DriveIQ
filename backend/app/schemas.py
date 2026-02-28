from pydantic import BaseModel, EmailStr, Field

class RegisterBody(BaseModel):
    name: str = Field(min_length=1)
    email: EmailStr
    password: str = Field(min_length=6)
    confirm_password: str = Field(min_length=6)
    role: str  # "instructor" or "trainee"
    institute_code: str | None = None  # required ONLY if role == instructor

class LoginBody(BaseModel):
    email: EmailStr
    password: str

class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

class TraineeJoinBody(BaseModel):
    join_code: str = Field(min_length=3)

class TripCreateBody(BaseModel):
    dataset_folder: str

class PredictBody(BaseModel):
    trip_id: str

class TipFeedbackBody(BaseModel):
    road_type: str | None = None
    notes: str | None = None
    expected_label: str | None = None
