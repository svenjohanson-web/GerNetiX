# Business Traceability View

Diese Datei ist eine generierte Lesesicht. Der validierte SQLite-Graph ist die kanonische Struktur.

Fuehrende Quellen:

- `data/business/business-traceability-metamodel.yaml`
- `data/business/business-goals.yaml`
- `data/business/business-strategies.yaml`
- `data/business/strategies.yaml`
- `data/business/measures.yaml`
- `data/business/business-capabilities.yaml`
- `data/business/business-rules.yaml`
- `data/requirements/business-requirements.yaml`

## Metamodell-Kette

```text
Vision
-> Business Goal
-> Business Capability
-> Strategy
-> Measure
-> Requirement
-> Architecture Artifact
-> Data Model / API Artifact
-> Implementation Artifact
-> Test Artifact
-> Validation Artifact
```

## ArchiMate-nahe Einordnung

Business Capability beschreibt, was das Unternehmen koennen muss.
Strategy / Course of Action beschreibt, wie diese Faehigkeit genutzt, aufgebaut oder ausgerichtet wird.
Measures sind konkrete Massnahmen zur Umsetzung.

Beispiel:

```text
BG-008 Nachhaltig profitabel wirtschaften
-> BC-041 Kostenkontrolle
-> business_strategy.optimize_costs Kosten optimieren
-> measure.ai_usage_monitoring KI Usage Monitoring
-> system_capability.admin_ai_usage_monitoring
```

## Statusmodell

Statusinformationen werden getrennt von der fachlichen Struktur gepflegt.

- `businessStatus`: Idea, In Analysis, Planned, Approved, Rejected, Deprecated
- `implementationStatus`: Not Started, In Planning, In Design, In Implementation, Implemented, Validated, Operational, Deprecated, Retired

## Beispielkette Nachhaltige Profitabilitaet

```text
vision.gernetix
-> BG-008 Nachhaltig profitabel wirtschaften
-> business_strategy.increase_revenue Umsatz steigern
-> strategy.retain_existing_customers Bestandskunden binden
-> measure.community_knowledge_platform Community / Wissensplattform
-> BC-015 Experten beantworten Fragen zeitnah
-> requirement.community_question_triage_time
-> architecture_artifact.community_knowledge_platform
-> data_model.community_question / api_artifact.community_questions
-> implementation_artifact.community_question_triage
-> test_artifact.community_question_triage_time
-> validation_artifact.community_response_sla
```

## Business Goal

`BG-008` Nachhaltig profitabel wirtschaften

Ziel:

Das Unternehmen soll nachhaltig Geld verdienen, ohne die langfristige Wissens- und Kundennutzenorientierung zu verlieren.

## Business Strategies

- `business_strategy.increase_revenue`: Umsatz steigern
- `business_strategy.build_recurring_revenue`: Wiederkehrende Umsaetze aufbauen
- `business_strategy.optimize_costs`: Kosten optimieren
- `business_strategy.long_term_competitiveness`: Langfristig wettbewerbsfaehig bleiben

## Strategies Unter Umsatz Steigern

- `strategy.acquire_new_customers`: Neukunden gewinnen
- `strategy.retain_existing_customers`: Bestandskunden binden
- `strategy.upselling_cross_selling`: Upselling und Cross-Selling
- `strategy.strategic_partnerships`: Strategische Partnerschaften aufbauen

## Measures

`measure.public_relations` Oeffentlichkeitsarbeit enthaelt:

- `measure.public_knowledge_platform`
- `measure.external_community_presence`
- `measure.makerworld_open_source_projects`
- `measure.schools_as_sales_channel`
- `measure.social_media`
- `measure.youtube`
- `measure.blog_articles`

`measure.community_knowledge_platform` ist eine Measure, keine Business Capability.

Weitere Measures:

- `measure.platform_centric_work`
- `measure.subscription_lifecycle`
- `measure.continuous_learning_paths`
- `measure.premium_memberships`
- `measure.extended_ai_features`
- `measure.premium_courses`
- `measure.hardware_kits`
- `measure.project_templates`
- `measure.extended_cloud_resources`
- `measure.individual_coaching`

## Business Capabilities

Business Capability ist der Einsprungpunkt ins Requirements Engineering.

Beispiele:

- `BC-015`: Experten beantworten Fragen zeitnah
- `BC-016`: Antworten werden fachlich verifiziert
- `BC-017`: Kurze FAQ-artige Loesungsantworten bereitstellen
- `BC-018`: Dauerhafte Wissensbasis aufbauen
- `BC-019`: Projektbezogene Diskussionen ermoeglichen
- `BC-001`: Value-based Bundling und Upselling

## Business Rules

- `BR-001`: Externe Verweise ohne Spam
- `BR-002`: Kein vollstaendiger Projektexport
- `BR-003`: Karenzzeit nach Abonnementablauf
- `BR-004`: Personenbezogene Projektdaten nach 30 Tagen loeschen
- `BR-005`: Oeffentliche Wissensbeitraege anonymisiert erhalten

## Requirements-Beispiel

Aus `BC-015` und `BC-016` entstehen erste pruefbare Requirements:

- `requirement.public_content_indexable`
- `requirement.community_question_triage_time`
- `requirement.community_answer_verification`
- `requirement.verified_answer_status_visible`
- `requirement.reverify_changed_verified_answer`

Diese Requirements verweisen weiter auf Architektur-, Datenmodell-, API-, Implementierungs-, Test- und Validation-Artefakte.
