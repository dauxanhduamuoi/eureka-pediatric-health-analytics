from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence


@dataclass(frozen=True)
class ParentDiseaseVisibilitySnapshot:
    """Immutable, validated Parent-only policy applied before Top K."""

    version: int
    disabled_ids: frozenset[str]
    manifest_count: int

    def filter_indices(
        self,
        indices: Sequence[int],
        disease_order: Sequence[str],
    ) -> list[int]:
        return [
            int(index)
            for index in indices
            if disease_order[int(index)] not in self.disabled_ids
        ]

    @property
    def enabled_count(self) -> int:
        return self.manifest_count - len(self.disabled_ids)
