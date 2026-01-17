from django.contrib import admin
from .models import Unit, ResourceRequest, RequestAssignment, LogEntry

admin.site.register(Unit)
admin.site.register(ResourceRequest)
admin.site.register(RequestAssignment)
admin.site.register(LogEntry)
