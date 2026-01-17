from django.db import models
from django.utils import timezone


class Unit(models.Model):
    class UnitType(models.TextChoices):
        AMBULANCE = "AMB", "Ambulance"
        ENGINE = "ENG", "Engine"

    class Status(models.TextChoices):
        AVAILABLE = "AVAILABLE", "Available"
        ENROUTE = "ENROUTE", "Enroute to scene"
        ON_SCENE = "ON_SCENE", "On scene"
        TRANSPORTING = "TRANSPORTING", "Transporting to hospital"

    name = models.CharField(max_length=50, unique=True)  # "Ambulance 3"
    unit_type = models.CharField(max_length=10, choices=UnitType.choices)
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.AVAILABLE)

    def __str__(self):
        return f"{self.name} ({self.unit_type})"


class ResourceRequest(models.Model):
    class RequestStatus(models.TextChoices):
        PENDING = "PENDING", "Pending"
        APPROVED = "APPROVED", "Approved"
        DENIED = "DENIED", "Denied"
        PARTIAL = "PARTIAL", "Partially fulfilled"
        COMPLETED = "COMPLETED", "Completed"

    unit_type = models.CharField(max_length=10, choices=Unit.UnitType.choices)
    quantity = models.IntegerField(default=1)

    priority = models.CharField(max_length=20, blank=True, default="Medium")
    location = models.CharField(max_length=200, blank=True, default="")

    status = models.CharField(max_length=20, choices=RequestStatus.choices, default=RequestStatus.PENDING)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class RequestAssignment(models.Model):
    request = models.ForeignKey(ResourceRequest, on_delete=models.CASCADE, related_name="assignments")
    unit = models.ForeignKey(Unit, on_delete=models.CASCADE, related_name="assignments")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("request", "unit")


class LogEntry(models.Model):
    """
    Immutable status transition log (status changes only).
    """
    created_at = models.DateTimeField(auto_now_add=True)
    unit = models.ForeignKey(Unit, on_delete=models.CASCADE, related_name="logs")
    from_status = models.CharField(max_length=30)
    to_status = models.CharField(max_length=30)

    def __str__(self):
        return f"{self.created_at} | {self.unit.name}: {self.from_status} -> {self.to_status}"


def change_unit_status(unit: Unit, new_status: str):
    """
    Only use this to change statuses (so logs are always recorded).
    """
    old = unit.status
    if old == new_status:
        return

    unit.status = new_status
    unit.last_status_at = timezone.now()
    unit.save(update_fields=["status", "last_status_at", "updated_at"])

    LogEntry.objects.create(
        unit=unit,
        from_status=old,
        to_status=new_status,
    )
