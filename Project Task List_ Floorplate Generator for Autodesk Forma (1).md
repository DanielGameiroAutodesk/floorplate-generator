# Project Task List: Floorplate Generator for Autodesk Forma

This task list is derived directly from the Functional Requirements (FR) and Technical Considerations outlined in the Product Requirements Document (PRD) (Version 1.0). Tasks are grouped into logical development phases and assigned a priority level.

**Priority Definitions:**
*   **P1 (Critical):** Core functionality, required for a Minimum Viable Product (MVP).
*   **P2 (High):** Essential features, required for a complete initial release.
*   **P3 (Medium):** Quality-of-life features, error handling, and polish.

---

## Phase 1: Setup, Integration, and Architecture (P1 Focus)

| Task ID | Task Description | PRD Req. | Priority |
| :--- | :--- | :--- | :--- |
| 1.1 | Initialize Forma Extension project structure (TypeScript, modular architecture). | Tech | P1 |
| 1.2 | Implement Forma API connection for importing building geometry (footprint, height). | 4.1.1, 4.1.2 | P1 |
| 1.3 | Implement Forma API connection for exporting final floorplate elements (spaces, walls). | 4.6.38 | P1 |
| 1.4 | Set up data persistence for saving user input values within the Forma project. | Tech | P2 |
| 1.5 | Implement performance monitoring to track generation speed (5-second target). | 4.3.17, Tech | P1 |

## Phase 2: User Interface and Input Handling (P2 Focus)

| Task ID | Task Description | PRD Req. | Priority |
| :--- | :--- | :--- | :--- |
| 2.1 | Develop the main side panel UI with collapsible sections (consistent with Forma design). | 4.2.6, Design | P2 |
| 2.2 | Implement Unit Mix input fields, color pickers, and 100% sum validation. | 4.2.7, 4.2.8 | P2 |
| 2.3 | Implement default unit size values (590, 885, 1180, 1475 sq ft). | 4.2.9 | P2 |
| 2.4 | Implement Egress input fields (Type, Travel Distance, Common Path, Dead-End). | 4.2.10 | P2 |
| 2.5 | Implement default egress values based on "Sprinklered/Unsprinklered" selection. | 4.2.11 | P2 |
| 2.6 | Implement Constraints input fields (Corridor Width, Core Dimensions, Core Side, Alignment Slider). | 4.2.12 | P2 |
| 2.7 | Implement Presets dropdown and logic to populate all input fields (Luxury, Affordable, Mixed-Income). | 4.2.13, 4.2.14 | P2 |
| 2.8 | Implement the "Generate" button and link it to the generation module. | 4.2.15 | P1 |

## Phase 3: Core Geometry and Analysis Module (P1 Focus)

| Task ID | Task Description | PRD Req. | Priority |
| :--- | :--- | :--- | :--- |
| 3.1 | Develop geometry module for footprint analysis and shape detection (Bar/Multi-wing). | 4.1.3 | P1 |
| 3.2 | Implement wing and intersection point detection logic for complex shapes. | 4.1.4 | P1 |
| 3.3 | Implement validation for minimum footprint size and irregular geometry. | 4.1.5, 4.7.42 | P2 |
| 3.4 | Implement core geometric functions (e.g., polygon offsetting, area calculation, line intersection). | Tech | P1 |

## Phase 4: Floorplate Generation Algorithms (P1 Focus)

| Task ID | Task Description | PRD Req. | Priority |
| :--- | :--- | :--- | :--- |
| 4.1 | Implement automatic corridor path generation (centerline, branching for wings). | 4.3.18 | P1 |
| 4.2 | Implement core placement logic (End, Middle, Intersection, Side preference). | 4.3.19 | P1 |
| 4.3 | Implement Unit Placement Module: Divide space into segments and assign unit types. | 4.3.21 | P1 |
| 4.4 | Implement unit shape logic: Ensure corridor access, facade access, and allow L-shapes. | 4.3.21, 4.3.22 | P1 |
| 4.5 | Implement demising wall alignment logic based on the strictness slider. | 4.3.23 | P2 |
| 4.6 | Implement utility space creation logic for leftover areas. | 4.3.24 | P3 |
| 4.7 | Implement **Efficiency Optimized** generation algorithm (Option 1). | 4.3.16 | P1 |
| 4.8 | Implement **Unit Mix Optimized** generation algorithm (Option 2). | 4.3.16 | P1 |
| 4.9 | Implement **Balanced** generation algorithm (Option 3). | 4.3.16 | P1 |

## Phase 5: Egress and Constraint Validation (P1 Focus)

| Task ID | Task Description | PRD Req. | Priority |
| :--- | :--- | :--- | :--- |
| 5.1 | Develop Egress Validation Module (Travel Distance, Common Path, Dead-End checks). | 4.3.20 | P1 |
| 5.2 | Implement logic to automatically add cores if initial placement fails egress validation. | 4.3.20 | P1 |
| 5.3 | Implement validation for unit sizes being too large for the building footprint. | 4.7.43 | P3 |
| 5.4 | Implement error message display when egress requirements cannot be met (even with max cores). | 4.7.44 | P3 |

## Phase 6: Display, Metrics, and Visualization (P2 Focus)

| Task ID | Task Description | PRD Req. | Priority |
| :--- | :--- | :--- | :--- |
| 6.1 | Implement simultaneous display of all three generated options in the Forma viewport. | 4.4.25 | P2 |
| 6.2 | Implement color coding for units, corridors, cores, and utility spaces. | 4.4.26 | P2 |
| 6.3 | Develop the metrics panel UI for each option (GSF, NRSF, Efficiency, Unit Count, Mix). | 4.4.27 | P2 |
| 6.4 | Implement logic to highlight the option that best meets the user's primary goal. | 4.4.28 | P3 |

## Phase 7: Interactive Corridor Editing (P2 Focus)

| Task ID | Task Description | PRD Req. | Priority |
| :--- | :--- | :--- | :--- |
| 7.1 | Implement "Edit Mode" selection for a generated option. | 4.5.29 | P2 |
| 7.2 | Implement corridor path visualization with draggable nodes (control points). | 4.5.30 | P2 |
| 7.3 | Implement real-time update logic: On node drag, re-run unit placement and metrics update. | 4.5.31 | P2 |
| 7.4 | Implement validation check during editing: Display warning if edit violates egress. | 4.5.32 | P2 |
| 7.5 | Implement functionality to add new corridor nodes. | 4.5.33 | P3 |
| 7.6 | Implement functionality to delete corridor nodes. | 4.5.34 | P3 |
| 7.7 | Implement "Undo" and "Reset to Original" buttons for corridor edits. | 4.5.35, 4.5.36 | P3 |

## Phase 8: Final Output and Export (P1 Focus)

| Task ID | Task Description | PRD Req. | Priority |
| :--- | :--- | :--- | :--- |
| 8.1 | Implement "Release to Forma" button for the selected option. | 4.6.37 | P1 |
| 8.2 | Implement conversion of floorplate elements to native Forma components (spaces, walls, cores). | 4.6.38 | P1 |
| 8.3 | Implement logic to apply the floorplate to all floors of the building. | 4.6.39 | P1 |
| 8.4 | Ensure color coding and metadata (unit type, area) are preserved in the Forma output. | 4.6.40 | P2 |
| 8.5 | Verify that exported elements are editable using standard Forma tools. | 4.6.41 | P2 |

## Phase 9: Testing, Documentation, and Polish (P3 Focus)

| Task ID | Task Description | PRD Req. | Priority |
| :--- | :--- | :--- | :--- |
| 9.1 | Implement progress indicator for long generation times (over 10 seconds). | 4.7.45 | P3 |
| 9.2 | Implement robust error logging and user-friendly error messages for unexpected failures. | 4.7.46 | P3 |
| 9.3 | Write unit tests for all geometric calculation functions. | Tech | P2 |
| 9.4 | Write integration tests for data exchange with the Forma API. | Tech | P2 |
| 9.5 | Write end-to-end tests for the complete user workflow (Input -> Generate -> Export). | Tech | P2 |
| 9.6 | Conduct cross-browser compatibility testing (Chrome, Firefox, Edge, Safari). | Tech | P3 |
| 9.7 | Final review of UI/UX against Design Considerations (Consistency, Clarity, Accessibility). | Design | P3 |
| 9.8 | Create initial developer documentation and deployment guide. | Tech | P3 |
