# Final LightGBM OVR H14 WITH WEATHER deployment

221 per-disease LightGBM boosters recreated from the locked final protocol.
Training data: TRAIN + VALIDATION only. TEST is not training data.
This persistence run does not perform tuning or model selection.

## Parent disease visibility

Parent visibility is runtime operator configuration stored in the application database.
On first use, all 221 manifest disease groups are enabled. Authorized operators can hide
or restore individual groups in Settings; the persisted disabled-ID set is validated
against this deployment's locked manifest and applied after scoring but before Top K.

The database setting and append-only audit are created by migration v018. A missing
singleton row means first use (all enabled); corrupt or unavailable persisted storage
fails closed and never silently reopens hidden groups.
