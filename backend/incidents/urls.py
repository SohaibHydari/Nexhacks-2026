from django.urls import path
from . import views

urlpatterns = [
    path("units/", views.units_list),
    path("units/<int:unit_id>/status/", views.unit_set_status),

    path("requests/", views.requests_list),
    path("requests/create/", views.create_request),
    path("requests/<int:request_id>/dispatch/", views.dispatch_request),

    path("logs/", views.logs_list),
    path("initial-prediction/", views.initial_prediction),
]
