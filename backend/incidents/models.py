from django.db import models

class Unit(models.Model):
    class UnitType(models.TextChoices):
        AMBULANCE = "AMB", "Ambulance"
        ENGINE = "ENG", "Engine"

    class Status(models.TextChoices):
        AVAILABLE = "AVAILABLE", "Available"
        DISPATCHED = "DISPATCHED", "Dispatched"
        TO_SCENE = "TO_SCENE", "In transit to scene"
        ON_SCENE = "ON_SCENE", "On scene"
        TO_HOSPITAL = "TO_HOSPITAL", "In transit to hospital"
        AT_HOSPITAL = "AT_HOSPITAL", "At hospital"
        OUT_OF_SERVICE = "OOS", "Out of service"

    name = models.CharField(max_length=50, unique=True)  # "Ambulance 3"
    unit_type = models.CharField(max_length=10, choices=UnitType.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.AVAILABLE)
    last_update = models.DateTimeField(auto_now=True)

class ResourceRequest(models.Model):
    class RequestStatus(models.TextChoices):
        PENDING = "PENDING", "Pending"
        APPROVED = "APPROVED", "Approved"
        DENIED = "DENIED", "Denied"
        PARTIAL = "PARTIAL", "Partially fulfilled"

    requested_by_role = models.CharField(max_length=20)  # FIRE / EMS / IC (keep simple for hackathon)
    unit_type = models.CharField(max_length=10, choices=Unit.UnitType.choices)
    quantity = models.IntegerField(default=1)
    note = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=RequestStatus.choices, default=RequestStatus.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)

class RequestAssignment(models.Model):
    request = models.ForeignKey(ResourceRequest, on_delete=models.CASCADE, related_name="assignments")
    unit = models.ForeignKey(Unit, on_delete=models.CASCADE, related_name="assignments")
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("request", "unit")

class LogEntry(models.Model):
    timestamp = models.DateTimeField(auto_now_add=True)
    unit = models.ForeignKey(Unit, on_delete=models.CASCADE, related_name="logs")
    event_type = models.CharField(max_length=50)  # DISPATCHED, ARRIVED_ON_SCENE, etc.
    details = models.TextField(blank=True)


