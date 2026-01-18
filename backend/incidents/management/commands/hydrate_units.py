import random

from django.core.management.base import BaseCommand

from ...models import Unit


class Command(BaseCommand):
    help = "Create 10 available ambulances with randomized names."

    def handle(self, *args, **options):
        numbers = random.sample(range(1, 101), k=10)

        created = []
        for number in numbers:
            name = f"Ambulance {number}"

            _, was_created = Unit.objects.update_or_create(
                name=name,
                defaults={
                    "unit_type": Unit.UnitType.AMBULANCE,
                    "status": Unit.Status.AVAILABLE,
                },
            )
            created.append((name, was_created))

        for name, was_created in created:
            verb = "Created" if was_created else "Updated"
            self.stdout.write(f"{verb}: {name}")
