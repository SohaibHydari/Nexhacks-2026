from rest_framework import serializers
from .models import Unit, ResourceRequest, RequestAssignment, LogEntry

class UnitSerializer(serializers.ModelSerializer):
    class Meta:
        model = Unit
        fields = "__all__"

class ResourceRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = ResourceRequest
        fields = "__all__"

class RequestAssignmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = RequestAssignment
        fields = "__all__"

class LogEntrySerializer(serializers.ModelSerializer):
    unit_name = serializers.CharField(source="unit.name", read_only=True)

    class Meta:
        model = LogEntry
        fields = ["id", "created_at", "unit", "unit_name", "from_status", "to_status"]
