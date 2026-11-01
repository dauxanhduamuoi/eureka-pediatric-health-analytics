# Project archive — Eureka

Kho lưu trữ báo cáo và evidence lịch sử. Không phải thư mục source, runtime hoặc dữ liệu bệnh nhân.

- [Báo cáo housekeeping](HOUSEKEEPING_REPORT.md).
- [MOVE_MANIFEST.csv](MOVE_MANIFEST.csv): tra từng file theo đường dẫn gốc, đường dẫn mới và SHA-256 trước/sau.
- [Phân loại từng file ứng viên](housekeeping_evidence/FINAL_CLASSIFICATION.csv).
- [Tài liệu giữ nguyên và evidence nền tảng](housekeeping_evidence/RETAINED_DOCUMENT_CATALOG.csv).
- [Kết quả xác minh](housekeeping_evidence/verification.json).

## Các nhóm

- `codex_evidence/`: nguyên cụm báo cáo, logs, validation, diff và snapshot đã xác minh; bên trong giữ lại cấu trúc `admin_redesign/...` hoặc `weather_disease_ai_v3/...`.
- `legacy_docs/`: dành cho tài liệu cũ đã xác minh hết vai trò. Đợt này chưa chuyển README nào vào đây.
- `misc_archive/`: dành cho artefact lịch sử an toàn khác. Đợt này chưa chuyển mục nào vào đây.
- `housekeeping_evidence/`: inventory, kế hoạch, journal, script kiểm tra và bằng chứng của lần sắp xếp này.

## Tìm và khôi phục khi cần

Tìm tên task hoặc `original_path` trong bảng bên dưới hay manifest. Nội dung các file được chuyển giữ nguyên từng byte; những đường dẫn repo gốc ghi trong logs/baseline vẫn là dữ liệu lịch sử. Không sửa chúng để tạo cảm giác báo cáo được chạy lại.

Để đưa một cụm trở lại, đối chiếu SHA-256 với manifest, bảo đảm đường dẫn gốc chưa được tái sử dụng rồi mới di chuyển nguyên cụm ngược lại bằng filesystem. Nếu đường dẫn gốc có file mới, dừng để xử lý xung đột, không ghi đè. Các snapshot `source_before` không được coi là source đang chạy. Không thực hiện khôi phục trong task này.

Những cụm có script phụ thuộc vị trí hoặc payload chưa rõ được giữ nguyên; không tạo symlink/junction và không tự sửa script để ép việc lưu trữ.


## Archived tasks ? original to archived paths

| Original path | Archived bundle / report | Files |
| --- | --- | ---: |
| `admin_redesign/soft_healthcare_green_v1/admin_chart_visual_refinement_v1` | [report](codex_evidence/admin_redesign/soft_healthcare_green_v1/admin_chart_visual_refinement_v1/REPORT.md) ? `codex_evidence/admin_redesign/soft_healthcare_green_v1/admin_chart_visual_refinement_v1` | 20 |
| `admin_redesign/soft_healthcare_green_v1/admin_final_micro_polish_v1` | [report](codex_evidence/admin_redesign/soft_healthcare_green_v1/admin_final_micro_polish_v1/REPORT.md) ? `codex_evidence/admin_redesign/soft_healthcare_green_v1/admin_final_micro_polish_v1` | 18 |
| `admin_redesign/soft_healthcare_green_v1/admin_weather_ai_compact_results_v1` | [report](codex_evidence/admin_redesign/soft_healthcare_green_v1/admin_weather_ai_compact_results_v1/REPORT.md) ? `codex_evidence/admin_redesign/soft_healthcare_green_v1/admin_weather_ai_compact_results_v1` | 15 |
| `admin_redesign/soft_healthcare_green_v1/dashboard_layout_refinement_v1` | [report](codex_evidence/admin_redesign/soft_healthcare_green_v1/dashboard_layout_refinement_v1/DASHBOARD_LAYOUT_REFINEMENT_REPORT.md) ? `codex_evidence/admin_redesign/soft_healthcare_green_v1/dashboard_layout_refinement_v1` | 12 |
| `admin_redesign/soft_healthcare_green_v1/dashboard_top_groups_chart_toggle_v1` | [report](codex_evidence/admin_redesign/soft_healthcare_green_v1/dashboard_top_groups_chart_toggle_v1/TOP_GROUPS_CHART_TOGGLE_REPORT.md) ? `codex_evidence/admin_redesign/soft_healthcare_green_v1/dashboard_top_groups_chart_toggle_v1` | 13 |
| `admin_redesign/soft_healthcare_green_v1/dashboard_two_column_layout_v1` | [report](codex_evidence/admin_redesign/soft_healthcare_green_v1/dashboard_two_column_layout_v1/DASHBOARD_TWO_COLUMN_LAYOUT_REPORT.md) ? `codex_evidence/admin_redesign/soft_healthcare_green_v1/dashboard_two_column_layout_v1` | 11 |
| `admin_redesign/soft_healthcare_green_v1/eureka_distinctive_design_v1` | [evidence bundle](codex_evidence/admin_redesign/soft_healthcare_green_v1/eureka_distinctive_design_v1) ? `codex_evidence/admin_redesign/soft_healthcare_green_v1/eureka_distinctive_design_v1` | 40 |
| `admin_redesign/soft_healthcare_green_v1/login_final_micro_polish_v1` | [report](codex_evidence/admin_redesign/soft_healthcare_green_v1/login_final_micro_polish_v1/REPORT.md) ? `codex_evidence/admin_redesign/soft_healthcare_green_v1/login_final_micro_polish_v1` | 12 |
| `admin_redesign/soft_healthcare_green_v1/login_photo_carousel_v1` | [report](codex_evidence/admin_redesign/soft_healthcare_green_v1/login_photo_carousel_v1/REPORT.md) ? `codex_evidence/admin_redesign/soft_healthcare_green_v1/login_photo_carousel_v1` | 15 |
| `admin_redesign/soft_healthcare_green_v1/permissions_management_redesign_v1` | [report](codex_evidence/admin_redesign/soft_healthcare_green_v1/permissions_management_redesign_v1/PERMISSIONS_MANAGEMENT_REDESIGN_REPORT.md) ? `codex_evidence/admin_redesign/soft_healthcare_green_v1/permissions_management_redesign_v1` | 33 |
| `admin_redesign/soft_healthcare_green_v1/safe_rollback_distinctive_ui_v1` | [report](codex_evidence/admin_redesign/soft_healthcare_green_v1/safe_rollback_distinctive_ui_v1/REPORT.md) ? `codex_evidence/admin_redesign/soft_healthcare_green_v1/safe_rollback_distinctive_ui_v1` | 28 |
| `admin_redesign/soft_healthcare_green_v1/sidebar_color_refinement_v1` | [report](codex_evidence/admin_redesign/soft_healthcare_green_v1/sidebar_color_refinement_v1/SIDEBAR_COLOR_REFINEMENT_REPORT.md) ? `codex_evidence/admin_redesign/soft_healthcare_green_v1/sidebar_color_refinement_v1` | 10 |
| `admin_redesign/soft_healthcare_green_v1/sidebar_refinement_v1` | [report](codex_evidence/admin_redesign/soft_healthcare_green_v1/sidebar_refinement_v1/SIDEBAR_REFINEMENT_REPORT.md) ? `codex_evidence/admin_redesign/soft_healthcare_green_v1/sidebar_refinement_v1` | 16 |
| `admin_redesign/soft_healthcare_green_v1/topbar_page_header_refinement_v1` | [report](codex_evidence/admin_redesign/soft_healthcare_green_v1/topbar_page_header_refinement_v1/TOPBAR_PAGE_HEADER_REFINEMENT_REPORT.md) ? `codex_evidence/admin_redesign/soft_healthcare_green_v1/topbar_page_header_refinement_v1` | 132 |
| `admin_redesign/soft_healthcare_green_v1/topbar_visual_refinement_v1` | [report](codex_evidence/admin_redesign/soft_healthcare_green_v1/topbar_visual_refinement_v1/TOPBAR_VISUAL_REFINEMENT_REPORT.md) ? `codex_evidence/admin_redesign/soft_healthcare_green_v1/topbar_visual_refinement_v1` | 12 |
| `admin_redesign/soft_healthcare_green_v1/typography_controls_login_v1` | [report](codex_evidence/admin_redesign/soft_healthcare_green_v1/typography_controls_login_v1/REPORT.md) ? `codex_evidence/admin_redesign/soft_healthcare_green_v1/typography_controls_login_v1` | 20 |
| `admin_redesign/soft_healthcare_green_v1/weather_ai_admin_missing_values_fix_v1` | [report](codex_evidence/admin_redesign/soft_healthcare_green_v1/weather_ai_admin_missing_values_fix_v1/REPORT.md) ? `codex_evidence/admin_redesign/soft_healthcare_green_v1/weather_ai_admin_missing_values_fix_v1` | 15 |
| `weather_disease_ai_v3/auto_medical_knowledge_default_visibility_v1` | [report](codex_evidence/weather_disease_ai_v3/auto_medical_knowledge_default_visibility_v1/AUTO_MEDICAL_KNOWLEDGE_DEFAULT_VISIBILITY_V1_REPORT.md) ? `codex_evidence/weather_disease_ai_v3/auto_medical_knowledge_default_visibility_v1` | 2 |
| `weather_disease_ai_v3/auto_medical_knowledge_v1` | [report](codex_evidence/weather_disease_ai_v3/auto_medical_knowledge_v1/AUTO_MEDICAL_KNOWLEDGE_RUNTIME_TOGGLE_REPORT.md) ? `codex_evidence/weather_disease_ai_v3/auto_medical_knowledge_v1` | 26 |
| `weather_disease_ai_v3/auto_medical_knowledge_v2_multi_tier` | [report](codex_evidence/weather_disease_ai_v3/auto_medical_knowledge_v2_multi_tier/AUTO_MEDICAL_KNOWLEDGE_MULTI_TIER_V2_REPORT.md) ? `codex_evidence/weather_disease_ai_v3/auto_medical_knowledge_v2_multi_tier` | 2 |
| `weather_disease_ai_v3/e2e_validation` | [report](codex_evidence/weather_disease_ai_v3/e2e_validation/E2E_VALIDATION_REPORT.md) ? `codex_evidence/weather_disease_ai_v3/e2e_validation` | 2 |
| `weather_disease_ai_v3/final_parent_weather_ai_technical_audit_v1` | [report](codex_evidence/weather_disease_ai_v3/final_parent_weather_ai_technical_audit_v1/FINAL_PARENT_WEATHER_AI_V3_TECHNICAL_AUDIT_REPORT.md) ? `codex_evidence/weather_disease_ai_v3/final_parent_weather_ai_technical_audit_v1` | 3 |
| `weather_disease_ai_v3/frontend_integration` | [report](codex_evidence/weather_disease_ai_v3/frontend_integration/FRONTEND_INTEGRATION_REPORT.md) ? `codex_evidence/weather_disease_ai_v3/frontend_integration` | 2 |
| `weather_disease_ai_v3/medical_knowledge_admin_ui_redesign` | [report](codex_evidence/weather_disease_ai_v3/medical_knowledge_admin_ui_redesign/MEDICAL_KNOWLEDGE_ADMIN_UI_REDESIGN_REPORT.md) ? `codex_evidence/weather_disease_ai_v3/medical_knowledge_admin_ui_redesign` | 2 |
| `weather_disease_ai_v3/medical_knowledge_admin_ui_v2` | [report](codex_evidence/weather_disease_ai_v3/medical_knowledge_admin_ui_v2/MEDICAL_KNOWLEDGE_ADMIN_UI_V2_REPORT.md) ? `codex_evidence/weather_disease_ai_v3/medical_knowledge_admin_ui_v2` | 2 |
| `weather_disease_ai_v3/medical_knowledge_multi_source_provider_v1` | [report](codex_evidence/weather_disease_ai_v3/medical_knowledge_multi_source_provider_v1/MEDICAL_KNOWLEDGE_MULTI_SOURCE_PROVIDER_V1_REPORT.md) ? `codex_evidence/weather_disease_ai_v3/medical_knowledge_multi_source_provider_v1` | 2 |
| `weather_disease_ai_v3/medical_knowledge_multisource_library_import_fix_v1` | [report](codex_evidence/weather_disease_ai_v3/medical_knowledge_multisource_library_import_fix_v1/MEDICAL_KNOWLEDGE_MULTISOURCE_LIBRARY_IMPORT_FIX_V1_REPORT.md) ? `codex_evidence/weather_disease_ai_v3/medical_knowledge_multisource_library_import_fix_v1` | 2 |
| `weather_disease_ai_v3/medical_knowledge_source_settings_v1` | [report](codex_evidence/weather_disease_ai_v3/medical_knowledge_source_settings_v1/MEDICAL_KNOWLEDGE_SOURCE_SETTINGS_V1_REPORT.md) ? `codex_evidence/weather_disease_ai_v3/medical_knowledge_source_settings_v1` | 2 |
| `weather_disease_ai_v3/medical_knowledge_v1_admin_ui` | [report](codex_evidence/weather_disease_ai_v3/medical_knowledge_v1_admin_ui/MEDICAL_KNOWLEDGE_ADMIN_UI_V1_REPORT.md) ? `codex_evidence/weather_disease_ai_v3/medical_knowledge_v1_admin_ui` | 2 |
| `weather_disease_ai_v3/medical_knowledge_v1_approval` | [report](codex_evidence/weather_disease_ai_v3/medical_knowledge_v1_approval/MEDICAL_KNOWLEDGE_APPROVAL_V1_REPORT.md) ? `codex_evidence/weather_disease_ai_v3/medical_knowledge_v1_approval` | 2 |
| `weather_disease_ai_v3/medical_knowledge_v1_default_keyword` | [report](codex_evidence/weather_disease_ai_v3/medical_knowledge_v1_default_keyword/MEDICAL_KNOWLEDGE_DEFAULT_PUBMED_KEYWORD_V1_REPORT.md) ? `codex_evidence/weather_disease_ai_v3/medical_knowledge_v1_default_keyword` | 2 |
| `weather_disease_ai_v3/medical_knowledge_v1_direct_pmid` | [report](codex_evidence/weather_disease_ai_v3/medical_knowledge_v1_direct_pmid/MEDICAL_KNOWLEDGE_DIRECT_PMID_V1_REPORT.md) ? `codex_evidence/weather_disease_ai_v3/medical_knowledge_v1_direct_pmid` | 2 |
| `weather_disease_ai_v3/medical_knowledge_v1_evidence_content` | [report](codex_evidence/weather_disease_ai_v3/medical_knowledge_v1_evidence_content/MEDICAL_KNOWLEDGE_EVIDENCE_CONTENT_V1_REPORT.md) ? `codex_evidence/weather_disease_ai_v3/medical_knowledge_v1_evidence_content` | 2 |
| `weather_disease_ai_v3/medical_knowledge_v1_final_audit` | [report](codex_evidence/weather_disease_ai_v3/medical_knowledge_v1_final_audit/MEDICAL_KNOWLEDGE_V1_FINAL_AUDIT_REPORT.md) ? `codex_evidence/weather_disease_ai_v3/medical_knowledge_v1_final_audit` | 2 |
| `weather_disease_ai_v3/medical_knowledge_v1_foundation` | [report](codex_evidence/weather_disease_ai_v3/medical_knowledge_v1_foundation/MEDICAL_KNOWLEDGE_V1_FOUNDATION_REPORT.md) ? `codex_evidence/weather_disease_ai_v3/medical_knowledge_v1_foundation` | 2 |
| `weather_disease_ai_v3/medical_knowledge_v1_general_factors` | [report](codex_evidence/weather_disease_ai_v3/medical_knowledge_v1_general_factors/MEDICAL_KNOWLEDGE_GENERAL_FACTORS_V1_REPORT.md) ? `codex_evidence/weather_disease_ai_v3/medical_knowledge_v1_general_factors` | 2 |
| `weather_disease_ai_v3/medical_knowledge_v1_groq` | [report](codex_evidence/weather_disease_ai_v3/medical_knowledge_v1_groq/MEDICAL_KNOWLEDGE_GROQ_V1_REPORT.md) ? `codex_evidence/weather_disease_ai_v3/medical_knowledge_v1_groq` | 2 |
| `weather_disease_ai_v3/medical_knowledge_v1_live_smoke` | [report](codex_evidence/weather_disease_ai_v3/medical_knowledge_v1_live_smoke/LIVE_MEDICAL_KNOWLEDGE_SMOKE_REPORT.md) ? `codex_evidence/weather_disease_ai_v3/medical_knowledge_v1_live_smoke` | 2 |
| `weather_disease_ai_v3/medical_knowledge_v1_llm_draft` | [report](codex_evidence/weather_disease_ai_v3/medical_knowledge_v1_llm_draft/MEDICAL_KNOWLEDGE_LLM_DRAFT_V1_REPORT.md) ? `codex_evidence/weather_disease_ai_v3/medical_knowledge_v1_llm_draft` | 2 |
| `weather_disease_ai_v3/medical_knowledge_v1_ollama` | [report](codex_evidence/weather_disease_ai_v3/medical_knowledge_v1_ollama/MEDICAL_KNOWLEDGE_OLLAMA_V1_REPORT.md) ? `codex_evidence/weather_disease_ai_v3/medical_knowledge_v1_ollama` | 2 |
| `weather_disease_ai_v3/medical_knowledge_v1_parent_integration` | [report](codex_evidence/weather_disease_ai_v3/medical_knowledge_v1_parent_integration/MEDICAL_KNOWLEDGE_PARENT_INTEGRATION_V1_REPORT.md) ? `codex_evidence/weather_disease_ai_v3/medical_knowledge_v1_parent_integration` | 2 |
| `weather_disease_ai_v3/medical_knowledge_v1_pediatric_population` | [report](codex_evidence/weather_disease_ai_v3/medical_knowledge_v1_pediatric_population/MEDICAL_KNOWLEDGE_PEDIATRIC_POPULATION_V1_REPORT.md) ? `codex_evidence/weather_disease_ai_v3/medical_knowledge_v1_pediatric_population` | 2 |
| `weather_disease_ai_v3/medical_knowledge_v1_publish` | [report](codex_evidence/weather_disease_ai_v3/medical_knowledge_v1_publish/MEDICAL_KNOWLEDGE_PUBLISH_V1_REPORT.md) ? `codex_evidence/weather_disease_ai_v3/medical_knowledge_v1_publish` | 2 |
| `weather_disease_ai_v3/medical_knowledge_v1_pubmed` | [report](codex_evidence/weather_disease_ai_v3/medical_knowledge_v1_pubmed/PUBMED_RETRIEVAL_V1_REPORT.md) ? `codex_evidence/weather_disease_ai_v3/medical_knowledge_v1_pubmed` | 2 |
| `weather_disease_ai_v3/medical_knowledge_v1_source_capacity` | [report](codex_evidence/weather_disease_ai_v3/medical_knowledge_v1_source_capacity/MEDICAL_KNOWLEDGE_SOURCE_CAPACITY_V1_REPORT.md) ? `codex_evidence/weather_disease_ai_v3/medical_knowledge_v1_source_capacity` | 2 |
| `weather_disease_ai_v3/medical_knowledge_v1_source_library` | [report](codex_evidence/weather_disease_ai_v3/medical_knowledge_v1_source_library/MEDICAL_KNOWLEDGE_SOURCE_LIBRARY_V1_REPORT.md) ? `codex_evidence/weather_disease_ai_v3/medical_knowledge_v1_source_library` | 2 |
| `weather_disease_ai_v3/medical_knowledge_v1_unpublish` | [report](codex_evidence/weather_disease_ai_v3/medical_knowledge_v1_unpublish/MEDICAL_KNOWLEDGE_UNPUBLISH_V1_REPORT.md) ? `codex_evidence/weather_disease_ai_v3/medical_knowledge_v1_unpublish` | 2 |
| `weather_disease_ai_v3/medical_knowledge_who_provider_v1` | [report](codex_evidence/weather_disease_ai_v3/medical_knowledge_who_provider_v1/MEDICAL_KNOWLEDGE_WHO_PROVIDER_V1_REPORT.md) ? `codex_evidence/weather_disease_ai_v3/medical_knowledge_who_provider_v1` | 2 |
| `weather_disease_ai_v3/parent_gps_recovery_fix_v1` | [report](codex_evidence/weather_disease_ai_v3/parent_gps_recovery_fix_v1/PARENT_GPS_RECOVERY_FIX_REPORT.md) ? `codex_evidence/weather_disease_ai_v3/parent_gps_recovery_fix_v1` | 2 |
| `weather_disease_ai_v3/parent_visibility_filter_v1` | [report](codex_evidence/weather_disease_ai_v3/parent_visibility_filter_v1/PARENT_VISIBILITY_FILTER_REPORT.md) ? `codex_evidence/weather_disease_ai_v3/parent_visibility_filter_v1` | 3 |
| `weather_disease_ai_v3/pubmed_runtime_relevance_audit_v1` | [report](codex_evidence/weather_disease_ai_v3/pubmed_runtime_relevance_audit_v1/PUBMED_RUNTIME_RELEVANCE_AUDIT_V1_REPORT.md) ? `codex_evidence/weather_disease_ai_v3/pubmed_runtime_relevance_audit_v1` | 2 |
| `weather_disease_ai_v3/release_readiness` | [report](codex_evidence/weather_disease_ai_v3/release_readiness/RELEASE_READINESS_REPORT.md) ? `codex_evidence/weather_disease_ai_v3/release_readiness` | 2 |
| `weather_disease_ai_v3/reviewed_disease_concept_exact_lookup_v1` | [report](codex_evidence/weather_disease_ai_v3/reviewed_disease_concept_exact_lookup_v1/REVIEWED_DISEASE_CONCEPT_EXACT_LOOKUP_V1_REPORT.md) ? `codex_evidence/weather_disease_ai_v3/reviewed_disease_concept_exact_lookup_v1` | 3 |
| `weather_disease_ai_v3/reviewed_disease_factor_relation_v1` | [report](codex_evidence/weather_disease_ai_v3/reviewed_disease_factor_relation_v1/REVIEWED_DISEASE_FACTOR_RELATION_V1_REPORT.md) ? `codex_evidence/weather_disease_ai_v3/reviewed_disease_factor_relation_v1` | 3 |
| `weather_disease_ai_v3/reviewed_per_provider_search_results_v1` | [report](codex_evidence/weather_disease_ai_v3/reviewed_per_provider_search_results_v1/REVIEWED_PER_PROVIDER_SEARCH_RESULTS_V1_REPORT.md) ? `codex_evidence/weather_disease_ai_v3/reviewed_per_provider_search_results_v1` | 2 |
| `weather_disease_ai_v3/reviewed_provider_execution_fix_v1` | [report](codex_evidence/weather_disease_ai_v3/reviewed_provider_execution_fix_v1/REVIEWED_PROVIDER_EXECUTION_FIX_V1_REPORT.md) ? `codex_evidence/weather_disease_ai_v3/reviewed_provider_execution_fix_v1` | 2 |
| `weather_disease_ai_v3/reviewed_search_quality_fix_v1` | [report](codex_evidence/weather_disease_ai_v3/reviewed_search_quality_fix_v1/REVIEWED_SEARCH_QUALITY_FIX_V1_REPORT.md) ? `codex_evidence/weather_disease_ai_v3/reviewed_search_quality_fix_v1` | 2 |
| `weather_disease_ai_v3/runtime_disease_factor_relation_parity_v1` | [report](codex_evidence/weather_disease_ai_v3/runtime_disease_factor_relation_parity_v1/RUNTIME_DISEASE_FACTOR_RELATION_PARITY_V1_REPORT.md) ? `codex_evidence/weather_disease_ai_v3/runtime_disease_factor_relation_parity_v1` | 2 |
| `weather_disease_ai_v3/service_configuration_v1` | [report](codex_evidence/weather_disease_ai_v3/service_configuration_v1/SERVICE_CONFIGURATION_V1_REPORT.md) ? `codex_evidence/weather_disease_ai_v3/service_configuration_v1` | 2 |
| `weather_disease_ai_v3/shap_display_collapse_v1` | [report](codex_evidence/weather_disease_ai_v3/shap_display_collapse_v1/SHAP_DISPLAY_COLLAPSE_REPORT.md) ? `codex_evidence/weather_disease_ai_v3/shap_display_collapse_v1` | 5 |
| `weather_disease_ai_v3/shared_reviewed_relevance_v1` | [report](codex_evidence/weather_disease_ai_v3/shared_reviewed_relevance_v1/SHARED_REVIEWED_RELEVANCE_V1_REPORT.md) ? `codex_evidence/weather_disease_ai_v3/shared_reviewed_relevance_v1` | 2 |
| `weather_disease_ai_v3/tier1_ui_improvement` | [report](codex_evidence/weather_disease_ai_v3/tier1_ui_improvement/TIER1_UI_IMPROVEMENT_REPORT.md) ? `codex_evidence/weather_disease_ai_v3/tier1_ui_improvement` | 2 |
| `weather_disease_ai_v3/weather_ai_admin_navigation_v1` | [report](codex_evidence/weather_disease_ai_v3/weather_ai_admin_navigation_v1/WEATHER_AI_ADMIN_NAVIGATION_REPORT.md) ? `codex_evidence/weather_disease_ai_v3/weather_ai_admin_navigation_v1` | 2 |
| `weather_disease_ai_v3/weather_ai_feature_contract_audit_v1` | [report](codex_evidence/weather_disease_ai_v3/weather_ai_feature_contract_audit_v1/WEATHER_AI_FEATURE_CONTRACT_AUDIT_V1_REPORT.md) ? `codex_evidence/weather_disease_ai_v3/weather_ai_feature_contract_audit_v1` | 2 |
| `weather_disease_ai_v3/weather_input_validation_fix_v1` | [report](codex_evidence/weather_disease_ai_v3/weather_input_validation_fix_v1/WEATHER_INPUT_VALIDATION_FIX_REPORT.md) ? `codex_evidence/weather_disease_ai_v3/weather_input_validation_fix_v1` | 2 |
| `weather_disease_ai_v3/who_provider_runtime_search_reliability_fix_v1` | [report](codex_evidence/weather_disease_ai_v3/who_provider_runtime_search_reliability_fix_v1/WHO_PROVIDER_RUNTIME_SEARCH_RELIABILITY_FIX_V1_REPORT.md) ? `codex_evidence/weather_disease_ai_v3/who_provider_runtime_search_reliability_fix_v1` | 2 |
| `weather_disease_ai_v3/who_reviewed_bounded_retrieval_fix_v1` | [report](codex_evidence/weather_disease_ai_v3/who_reviewed_bounded_retrieval_fix_v1/WHO_REVIEWED_BOUNDED_RETRIEVAL_FIX_V1_REPORT.md) ? `codex_evidence/weather_disease_ai_v3/who_reviewed_bounded_retrieval_fix_v1` | 2 |

## Retained evidence bundles

These paths remain outside the archive. Detailed reasons are in inventory-reviewed.json.

| Current path | Classification | Files |
| --- | --- | ---: |
| [admin_redesign/soft_healthcare_green_v1/admin_double_scroll_fix_v2](../admin_redesign/soft_healthcare_green_v1/admin_double_scroll_fix_v2) | REVIEW_REQUIRED | 59 |
| [admin_redesign/soft_healthcare_green_v1/admin_scroll_root_cause_fix_v1](../admin_redesign/soft_healthcare_green_v1/admin_scroll_root_cause_fix_v1) | REVIEW_REQUIRED | 23 |
| [admin_redesign/soft_healthcare_green_v1/advanced_analytics_notifications_batch_v1](../admin_redesign/soft_healthcare_green_v1/advanced_analytics_notifications_batch_v1) | REVIEW_REQUIRED | 25 |
| [admin_redesign/soft_healthcare_green_v1/age_insights_workspace_redesign_v1](../admin_redesign/soft_healthcare_green_v1/age_insights_workspace_redesign_v1) | REVIEW_REQUIRED | 23 |
| [admin_redesign/soft_healthcare_green_v1/analytics_usability_refinement_batch_v2](../admin_redesign/soft_healthcare_green_v1/analytics_usability_refinement_batch_v2) | REVIEW_REQUIRED | 25 |
| [admin_redesign/soft_healthcare_green_v1/area_insights_layout_refinement_v2](../admin_redesign/soft_healthcare_green_v1/area_insights_layout_refinement_v2) | REVIEW_REQUIRED | 22 |
| [admin_redesign/soft_healthcare_green_v1/area_insights_scroll_fix_v1](../admin_redesign/soft_healthcare_green_v1/area_insights_scroll_fix_v1) | REVIEW_REQUIRED | 18 |
| [admin_redesign/soft_healthcare_green_v1/area_insights_workspace_redesign_v1](../admin_redesign/soft_healthcare_green_v1/area_insights_workspace_redesign_v1) | REVIEW_REQUIRED | 22 |
| [admin_redesign/soft_healthcare_green_v1/branding_font_permissions_fix](../admin_redesign/soft_healthcare_green_v1/branding_font_permissions_fix) | REVIEW_REQUIRED | 15 |
| [admin_redesign/soft_healthcare_green_v1/content_redesign_v1](../admin_redesign/soft_healthcare_green_v1/content_redesign_v1) | REVIEW_REQUIRED | 126 |
| [admin_redesign/soft_healthcare_green_v1/data_management_redesign_batch_v1](../admin_redesign/soft_healthcare_green_v1/data_management_redesign_batch_v1) | REVIEW_REQUIRED | 27 |
| [admin_redesign/soft_healthcare_green_v1/final_demo_readiness_v1](../admin_redesign/soft_healthcare_green_v1/final_demo_readiness_v1) | REVIEW_REQUIRED | 200 |
| [admin_redesign/soft_healthcare_green_v1/forecast_account_redesign_batch_v1](../admin_redesign/soft_healthcare_green_v1/forecast_account_redesign_batch_v1) | REVIEW_REQUIRED | 24 |
| [admin_redesign/soft_healthcare_green_v1/reports_management_redesign_v1](../admin_redesign/soft_healthcare_green_v1/reports_management_redesign_v1) | REVIEW_REQUIRED | 40 |
| [admin_redesign/soft_healthcare_green_v1/reports_pdf_layout_refinement_v1](../admin_redesign/soft_healthcare_green_v1/reports_pdf_layout_refinement_v1) | REVIEW_REQUIRED | 33 |
| [weather_disease_ai_v3/final_parent_data_flow_guidance_fix_v1](../weather_disease_ai_v3/final_parent_data_flow_guidance_fix_v1) | REVIEW_REQUIRED | 6 |
| [weather_disease_ai_v3/final_test](../weather_disease_ai_v3/final_test) | REVIEW_REQUIRED | 26 |
| [weather_disease_ai_v3/parent_data_content_audit_v1](../weather_disease_ai_v3/parent_data_content_audit_v1) | REVIEW_REQUIRED | 9 |
| [weather_disease_ai_v3/parent_disease_eligibility_review](../weather_disease_ai_v3/parent_disease_eligibility_review) | REVIEW_REQUIRED | 1 |
| [weather_disease_ai_v3/reports](../weather_disease_ai_v3/reports) | REVIEW_REQUIRED | 1 |
| [weather_disease_ai_v3/shap_end_to_end_audit_v1](../weather_disease_ai_v3/shap_end_to_end_audit_v1) | REVIEW_REQUIRED | 9 |
| [weather_disease_ai_v3/shap_explanation_fix_v1](../weather_disease_ai_v3/shap_explanation_fix_v1) | KEEP_ACTIVE | 8 |
| [output/pdf](../output/pdf) | REVIEW_REQUIRED | 2 |
| [tmp/pdfs](../tmp/pdfs) | REVIEW_REQUIRED | 2 |
