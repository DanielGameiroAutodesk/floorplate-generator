# Product Requirements Document: Floorplate Generator for Autodesk Forma

**Document Version:** 1.0  
**Author:** Manus AI  
**Date:** December 17, 2025  
**Target Audience:** Junior Developers

---

## 1. Introduction/Overview

This document outlines the requirements for the **Floorplate Generator**, an extension for Autodesk Forma that automates the design of floorplates for multifamily residential buildings in the United States.

### What is a Floorplate?

A **floorplate** is the 2D layout of one floor of a building, showing how the space is divided into apartments, hallways (corridors), and vertical circulation elements (stairwells and elevators, collectively called "cores"). Creating a floorplate manually is a complex, time-consuming process that requires architects to balance multiple constraints including building codes, space efficiency, and desired apartment mix.

### The Problem

Currently, architects spend 4-8 hours manually creating a single floorplate design. They must:

- Draw corridors and place cores to meet fire safety regulations
- Divide remaining space into apartments of various sizes
- Ensure the unit mix matches the developer's requirements
- Calculate areas and verify efficiency ratios
- Iterate repeatedly as the design evolves

### The Solution

The Floorplate Generator automates this entire process. Users provide a building footprint and their requirements, and the extension generates three optimized floorplate options in seconds. This represents a time savings of over 90%, allowing architects to explore more design options and focus on higher-level design decisions rather than tedious layout work.

### Target Users

- **Architects** in early design phases
- **Real estate developers** evaluating project feasibility
- **Urban planners** assessing site capacity

---

## 2. Goals

The Floorplate Generator aims to achieve the following objectives:

1. **Drastically Reduce Design Time:** Reduce floorplate design time by at least 90% compared to manual methods (from 4-8 hours to under 30 minutes including review and adjustments).

2. **Ensure Building Code Compliance:** All generated layouts must comply with US building code requirements for means of egress, specifically:
   - Maximum travel distance to exits
   - Maximum common path of egress travel
   - Maximum dead-end corridor length

3. **Optimize Space Efficiency:** Generate layouts with net-to-gross efficiency ratios between 75-85%, maximizing rentable apartment area while minimizing circulation space.

4. **Support Diverse Building Shapes:** Handle both simple rectangular buildings and complex multi-wing configurations (L-shaped, U-shaped, V-shaped, etc.).

5. **Provide Design Flexibility:** Offer multiple algorithmic approaches and allow interactive refinement of generated layouts.

6. **Seamless Forma Integration:** Function as a native extension within Autodesk Forma with outputs that can be used directly in the Forma environment.

---

## 3. User Stories

**As an architect designing a new apartment building,** I want to quickly generate multiple floorplate layout options so that I can explore different design approaches and present alternatives to my client without spending days on manual drafting.

**As a real estate developer evaluating a potential project,** I want to input my desired unit mix and see how many apartments can fit in my building footprint so that I can quickly assess the financial viability and return on investment before committing to detailed design work.

**As an urban planner reviewing a development proposal,** I want to understand the residential capacity of different building massing options on a site so that I can make informed decisions about zoning requirements and community impact.

**As a junior architect learning building design,** I want to see how different corridor configurations affect unit layouts and efficiency so that I can understand the relationship between circulation and rentable area.

---

## 4. Functional Requirements

### 4.1 Building Input and Shape Recognition

**Context:** The extension operates on buildings that already exist in the Autodesk Forma environment. Users create building masses using Forma's native tools before launching the Floorplate Generator.

**Requirements:**

1. The system must import the building footprint geometry from the currently selected building in Autodesk Forma.

2. The system must extract the floor-to-floor height and total building height from the Forma building properties to determine the number of floors.

3. The system must analyze the building footprint to detect its shape type:
   - **Bar building:** Simple rectangular shape
   - **Multi-wing building:** Complex shapes with multiple extending sections (L, U, V, H, etc.)

4. For multi-wing buildings, the system must automatically detect individual wings and their intersection points. A **wing** is a distinct linear section of the building that extends from a central area.

5. The system must validate that the building footprint is suitable for residential floorplate generation. Buildings that are too small (less than 2,000 square feet) or have unusual geometries (curved walls, irregular polygons) should display an error message to the user.

### 4.2 User Interface - Input Panel

**Context:** All user inputs are provided through a side panel that appears when the extension is launched. The panel should follow Autodesk Forma's design system and use familiar UI patterns.

**Requirements:**

6. The system must display a side panel with collapsible sections for different input categories.

7. **Units Section:** The system must provide input fields for each apartment type:
   - Studio apartments: percentage of total units, target square footage, color picker
   - 1-Bedroom apartments: percentage of total units, target square footage, color picker
   - 2-Bedroom apartments: percentage of total units, target square footage, color picker
   - 3-Bedroom apartments: percentage of total units, target square footage, color picker

8. The system must validate that the unit mix percentages sum to 100%. If they do not, display a warning message.

9. The system must provide default values for unit sizes based on typical US multifamily standards:
   - Studio: 590 sq ft
   - 1-Bedroom: 885 sq ft
   - 2-Bedroom: 1,180 sq ft
   - 3-Bedroom: 1,475 sq ft

10. **Egress Section:** The system must provide input fields for fire safety parameters:
    - Building type: radio buttons for "Sprinklered" or "Unsprinklered"
    - Maximum travel distance (in feet)
    - Maximum common path of egress (in feet)
    - Maximum dead-end corridor length (in feet)

11. The system must provide default egress values based on the building type selection:
    - Sprinklered: 250 ft travel distance, 125 ft common path, 50 ft dead-end
    - Unsprinklered: 200 ft travel distance, 75 ft common path, 20 ft dead-end

12. **Constraints Section:** The system must provide input fields for:
    - Corridor width (feet)
    - End core dimensions: width × depth (feet)
    - Middle core dimensions: width × depth (feet)
    - Wing intersection core dimensions: width × depth (feet)
    - Number of cores: dropdown with "Auto" or fixed numbers (2, 3, 4, 5)
    - Core side preference: dropdown with "North", "South", "East", "West", "Auto"
    - Wall alignment strictness: slider from 0-100%

13. The system must provide a "Presets" dropdown with common configuration templates:
    - "Luxury High-Rise" (larger units, higher efficiency target)
    - "Affordable Housing" (smaller units, code minimum egress)
    - "Mixed-Income" (balanced unit mix)
    - "Custom" (user-defined values)

14. When a preset is selected, the system must populate all input fields with the preset values. Users can then modify individual values as needed.

15. The system must include a "Generate" button that initiates the floorplate generation process.

### 4.3 Floorplate Generation Algorithm

**Context:** This is the core functionality. The system must automatically create complete floorplate layouts by placing corridors, cores, and apartments in a way that satisfies all constraints.

**Requirements:**

16. When the user clicks "Generate", the system must produce three distinct floorplate layout options using different algorithmic approaches:
    - **Option 1 - Efficiency Optimized:** Prioritizes maximizing net-to-gross efficiency
    - **Option 2 - Unit Mix Optimized:** Prioritizes matching the target unit mix as closely as possible
    - **Option 3 - Balanced:** Balances efficiency and unit mix matching

17. The generation process must complete within 5 seconds for typical building footprints (up to 50,000 square feet per floor).

18. **Corridor Placement:** The system must automatically generate a corridor path that:
    - Runs through the center of the building footprint
    - For multi-wing buildings, branches into each wing
    - Maintains the user-specified corridor width
    - Provides access to all areas of the floor

19. **Core Placement:** The system must automatically place building cores (stairwells and elevators) according to these rules:
    - **End cores:** Placed at the ends of linear building sections or wings
    - **Middle cores:** Placed along the corridor when the building is long enough to require additional egress points
    - **Wing intersection cores:** Placed at the junction points where wings meet
    - Cores must be placed on the user-specified side of the corridor (North, South, East, West) except for wing intersection cores which always go at the inner corner
    - The number of cores must be sufficient to meet the egress requirements

20. **Egress Validation:** The system must verify that every point in the floorplate meets the egress requirements:
    - No point is farther than the maximum travel distance from a core
    - No point has a common path of egress longer than the maximum
    - No dead-end corridor exceeds the maximum length
    - If egress requirements cannot be met, the system must add additional cores automatically

21. **Unit Placement:** The system must divide the remaining space (after corridors and cores) into apartment units:
    - Units must be placed on both sides of the corridor (double-loaded corridor configuration)
    - Each unit must have access to the corridor through a single entry door
    - Each unit must have at least one exterior wall (facade access) for windows and natural light
    - Unit sizes should be as close as possible to the target square footages
    - The mix of unit types should match the user-specified percentages as closely as possible

22. The system must allow units to be L-shaped when necessary to fit around building geometry, but rectangular units are preferred when possible.

23. **Demising Wall Alignment:** The system must attempt to align demising walls (walls between adjacent units) across the corridor. This means if there is a wall between Unit A and Unit B on the north side of the corridor, there should ideally be a wall at the same location between units on the south side. The strictness of this alignment is controlled by the "Wall Alignment Strictness" slider.

24. The system must handle **utility spaces** (trash rooms, mechanical rooms) by creating small spaces (minimum size defined by user) when there are leftover areas that are too small for apartments.

### 4.4 Display and Visualization

**Context:** Users need to see and compare the three generated options clearly.

**Requirements:**

25. The system must display all three generated options simultaneously in the Forma viewport, arranged side-by-side or in a grid layout.

26. Each floorplate option must use color coding:
    - Studio apartments: user-selected color
    - 1-Bedroom apartments: user-selected color
    - 2-Bedroom apartments: user-selected color
    - 3-Bedroom apartments: user-selected color
    - Corridors: neutral gray
    - Cores: dark gray or black
    - Utility spaces: light gray

27. The system must display a metrics panel for each option showing:
    - Total Gross Square Footage (GSF)
    - Total Net Rentable Square Footage (NRSF)
    - Efficiency percentage (NRSF ÷ GSF × 100)
    - Unit count breakdown (number of each unit type)
    - Actual unit mix percentages
    - Average unit size for each type

28. The system must highlight which option best meets the user's goals (efficiency vs. unit mix matching).

### 4.5 Interactive Corridor Editing

**Context:** After generation, users may want to adjust the corridor path to explore variations or accommodate specific design preferences.

**Requirements:**

29. The system must allow users to select one of the three generated options to enter "Edit Mode".

30. In Edit Mode, the corridor must be displayed as an editable path with visible nodes (control points) that can be dragged.

31. When a user drags a corridor node to a new position:
    - The corridor path must update in real-time
    - The system must automatically regenerate the unit placement on both sides of the modified corridor
    - Cores must remain in their original positions unless they become invalid due to the corridor change
    - The metrics panel must update to reflect the new layout

32. The system must validate that corridor edits do not violate egress requirements. If an edit would cause a violation, display a warning message and suggest adding a core or reverting the change.

33. Users must be able to add new corridor nodes by clicking on the corridor path.

34. Users must be able to delete corridor nodes by right-clicking on a node and selecting "Delete".

35. The system must provide an "Undo" button to revert corridor edits.

36. The system must provide a "Reset to Original" button to restore the corridor to its initial generated state.

### 4.6 Export and Output

**Context:** Once satisfied with a layout, users need to export it for use in their Forma project.

**Requirements:**

37. The system must provide a "Release to Forma" button for the selected floorplate option.

38. When "Release to Forma" is clicked, the system must convert the floorplate elements into native Autodesk Forma building components:
    - Apartment units become Forma spaces with appropriate metadata (unit type, area)
    - Corridors become Forma circulation spaces
    - Cores become Forma vertical circulation elements
    - Demising walls and partition walls become Forma wall elements

39. The released floorplate must be applied to all floors of the building (or to user-selected floors if that option is provided).

40. The system must preserve the color coding of units in the Forma output.

41. After release, the floorplate elements must be editable using standard Forma tools.

### 4.7 Error Handling and Edge Cases

**Requirements:**

42. If the building footprint is too small to accommodate even one apartment of the smallest type, the system must display an error: "Building footprint is too small for residential units. Minimum area required: [X] sq ft."

43. If the user-specified unit sizes are too large for the building footprint, the system must display a warning: "Target unit sizes may be too large for this building. Consider reducing unit sizes or adjusting the unit mix."

44. If the system cannot generate a layout that meets egress requirements even with maximum core placement, it must display an error: "Cannot meet egress requirements with current parameters. Try reducing travel distance limits or modifying the building shape."

45. If the generation process takes longer than 10 seconds, the system must display a progress indicator with the message "Generating complex layout..."

46. If the system encounters an unexpected error during generation, it must display a user-friendly error message and log detailed error information for debugging purposes.

---

## 5. Non-Goals (Out of Scope)

To ensure a focused and achievable initial release, the following features are explicitly excluded from this version:

1. **Custom Unit Shapes:** The system will only generate rectangular and L-shaped apartment units. Complex or custom unit shapes (T-shaped, curved, etc.) are not supported.

2. **Non-US Building Codes:** All egress calculations and compliance checks are based on standard US building codes (International Building Code). Support for building codes from other countries is not included.

3. **Detailed Interior Layouts:** The extension defines the outer boundaries of apartments (demising walls) only. It does not generate the internal layout of rooms within apartments, such as bedroom placement, kitchen configuration, or bathroom locations.

4. **Cost Estimation:** The system does not include any functionality for estimating construction costs, material costs, or project budgets.

5. **Integration with Other Forma Extensions:** The initial release will not include direct integrations or data exchange with other third-party extensions available in the Autodesk Forma marketplace.

6. **Multi-Floor Variation:** All floors will receive the same floorplate layout. The system does not generate different layouts for different floors (e.g., amenity floors, penthouse floors).

7. **Accessibility Compliance:** While the system follows general best practices, it does not include specific checks for ADA (Americans with Disabilities Act) compliance or accessible unit requirements.

---

## 6. Design Considerations

### User Interface Design

The user interface should adhere to the following principles:

- **Consistency:** Follow the Autodesk Forma design system for colors, typography, spacing, and component styles.
- **Clarity:** Use clear labels and tooltips to explain technical terms (egress, demising walls, etc.) for users who may not be familiar with architecture terminology.
- **Efficiency:** Provide sensible default values for all inputs so that users can generate a layout with minimal configuration.
- **Visual Hierarchy:** Use collapsible sections and visual grouping to organize the many input parameters without overwhelming the user.

### Visual Feedback

- The corridor editing interface should provide immediate visual feedback as nodes are dragged.
- Color coding should be consistent and distinguishable for users with color vision deficiencies.
- Metrics should update in real-time as edits are made.

### Accessibility

- All interactive elements must be keyboard accessible.
- Color should not be the only means of conveying information (use labels and patterns as well).
- Text must meet WCAG 2.1 AA contrast requirements.

---

## 7. Technical Considerations

### Platform and Architecture

- **Extension Framework:** The extension must be built using the Autodesk Forma Extension API and SDK.
- **Programming Language:** Use TypeScript for type safety and better developer experience.
- **Architecture:** Implement a modular architecture with clear separation of concerns:
  - **Geometry Module:** Handles footprint analysis, wing detection, and geometric calculations
  - **Generation Module:** Contains the core algorithms for corridor, core, and unit placement
  - **Validation Module:** Checks egress compliance and other constraints
  - **UI Module:** Manages the side panel interface and user interactions
  - **Forma Integration Module:** Handles data import from and export to Autodesk Forma

### Performance Requirements

- **Generation Speed:** The floorplate generation process must complete within 5 seconds for typical buildings (up to 50,000 sq ft per floor).
- **Interactive Editing:** Corridor node dragging must feel responsive, with layout updates completing within 1 second.
- **Memory Management:** The extension should not consume excessive memory, especially when handling large or complex buildings.

### Browser Compatibility

The extension must be fully functional on the latest versions of:
- Google Chrome
- Mozilla Firefox
- Microsoft Edge
- Safari (macOS)

### Data Persistence

- User input values should be saved in the Forma project so that reopening the extension restores the previous configuration.
- Generated floorplate options should be cached so that users can switch between options without regenerating.

### Testing Considerations

- Unit tests should cover all geometric calculation functions.
- Integration tests should verify correct data exchange with the Forma API.
- End-to-end tests should validate the complete user workflow from input to export.
- Test with a variety of building shapes (rectangular, L, U, V, complex multi-wing).

### Known Technical Constraints

- The Autodesk Forma API may have limitations on the types of geometry that can be created or modified. The implementation should work within these constraints and document any workarounds.
- Performance may degrade for very large buildings (over 100,000 sq ft per floor). Consider implementing a warning or limitation for such cases.

---

## 8. Success Metrics

The success of the Floorplate Generator will be measured using the following metrics:

### Primary Metric: Time Savings

**Target:** 90% reduction in time required to create a floorplate design.

**Measurement Method:** Conduct user testing with architects who have experience in manual floorplate design. Measure the time from starting the task to producing a satisfactory layout, comparing manual methods to using the extension.

**Success Criteria:** Average time reduction of 90% or greater (e.g., from 4 hours to 24 minutes).

### Secondary Metrics

1. **User Adoption Rate**
   - **Target:** 500 active users within 6 months of release
   - **Measurement:** Track unique users who generate at least one floorplate per month

2. **Layout Quality - Efficiency**
   - **Target:** 80% of generated layouts achieve 75-85% efficiency ratio
   - **Measurement:** Automatically log the efficiency of all generated layouts

3. **Layout Quality - Unit Mix Accuracy**
   - **Target:** Average deviation from target unit mix is less than 5%
   - **Measurement:** Calculate the difference between target and actual percentages for each unit type

4. **User Satisfaction**
   - **Target:** Average rating of 4.0/5.0 or higher
   - **Measurement:** In-app survey after users export a floorplate, asking them to rate their satisfaction

5. **Error Rate**
   - **Target:** Less than 5% of generation attempts result in errors
   - **Measurement:** Track the ratio of successful generations to total generation attempts

6. **Feature Utilization**
   - **Measurement:** Track how often users use corridor editing vs. accepting generated layouts as-is
   - **Insight:** Helps understand whether the interactive editing feature is valuable

### Long-term Success Indicators

- Increased usage over time (indicating the tool is valuable and users return to it)
- Positive qualitative feedback and testimonials from users
- Requests for additional features and enhancements (indicating engagement)

---

## 9. Open Questions

The following questions require clarification or further investigation before or during implementation:

1. **Forma API Capabilities:**
   - What are the specific limitations of the Autodesk Forma Extension API regarding geometry creation and manipulation?
   - Are there restrictions on the number or complexity of elements that can be created?
   - What is the performance impact of creating hundreds of wall and space elements?

2. **Egress Calculation Details:**
   - Should travel distance be measured as straight-line distance or walking distance along corridors?
   - How should the system handle multi-floor egress scenarios (e.g., does a core need to extend through all floors)?

3. **User Preferences:**
   - Should the system remember user preferences across different projects or only within a single project?
   - Should there be a way to save and share custom presets between team members?

4. **Performance Benchmarks:**
   - Are there official Autodesk guidelines or benchmarks for extension performance?
   - What is considered an acceptable load time for extensions in the Forma environment?

5. **Validation and Testing:**
   - Will Autodesk provide test buildings or scenarios for validation?
   - Is there a certification or review process for extensions before they can be published?

6. **Future Enhancements:**
   - Which features from the "Future Enhancements" section of the source document should be prioritized for the next release?
   - Is there user research data on which features would provide the most value?

---

## Appendix A: Key Terms and Definitions

For developers unfamiliar with architecture and building design, the following terms are essential to understand:

| Term | Definition |
|------|------------|
| **Floorplate** | The 2D layout of one floor of a building showing all spaces and walls |
| **Footprint** | The outline of a building when viewed from above |
| **Wing** | A distinct linear section of a building that extends from a central area |
| **Bar Building** | A simple, elongated rectangular building shape |
| **Core** | A vertical shaft containing stairs and elevators for moving between floors |
| **Corridor** | A horizontal hallway that provides access to apartments |
| **Demising Wall** | The wall that separates two adjacent apartments |
| **Facade** | The exterior wall of a building |
| **Unit Mix** | The percentage distribution of different apartment types |
| **GSF** | Gross Square Footage - total floor area including all spaces |
| **NRSF** | Net Rentable Square Footage - only the apartment area |
| **Efficiency** | The ratio NRSF ÷ GSF, typically 75-85% for multifamily buildings |
| **Egress** | The path a person takes to exit a building during an emergency |
| **Travel Distance** | The walking distance from any point to the nearest exit |
| **Common Path of Egress** | The distance before a person has a choice of two different exit routes |
| **Dead-End Corridor** | A hallway section with only one direction to exit |
| **Sprinklered Building** | A building with automatic fire sprinklers, allowing more lenient egress rules |
| **Double-Loaded Corridor** | A hallway with apartments on both sides |

---

## Appendix B: Default Values Reference

The following default values should be used when the extension is first launched:

### Unit Mix and Sizes
- Studio: 20%, 590 sq ft
- 1-Bedroom: 40%, 885 sq ft
- 2-Bedroom: 30%, 1,180 sq ft
- 3-Bedroom: 10%, 1,475 sq ft

### Egress (Sprinklered Building)
- Maximum Travel Distance: 250 ft
- Maximum Common Path: 125 ft
- Maximum Dead-End Corridor: 50 ft

### Constraints
- Corridor Width: 5 ft
- End Core: 20 ft × 25 ft
- Middle Core: 18 ft × 22 ft
- Wing Intersection Core: 22 ft × 28 ft
- Number of Cores: Auto
- Core Side: Auto
- Wall Alignment Strictness: 50%
- Minimum Utility Space Size: 5 ft

---

## Appendix C: Algorithm Overview

For developers implementing the generation logic, here is a high-level overview of the algorithm flow:

### Step 1: Footprint Analysis
1. Import building footprint geometry from Forma
2. Detect if the building is a simple bar or multi-wing configuration
3. For multi-wing buildings, identify individual wings and intersection points
4. Calculate the overall dimensions and area

### Step 2: Corridor Generation
1. For bar buildings, create a straight corridor through the center
2. For multi-wing buildings, create a branching corridor that reaches into each wing
3. Apply the user-specified corridor width

### Step 3: Core Placement
1. Place end cores at the extremities of the building or wings
2. Calculate if additional middle cores are needed based on egress requirements
3. Place wing intersection cores at junction points
4. Apply the user-specified core dimensions and side preferences

### Step 4: Egress Validation
1. Calculate travel distances from all points in the floorplate to the nearest core
2. Identify common paths of egress and measure their lengths
3. Identify dead-end corridors and measure their lengths
4. If any egress requirement is violated, add additional cores and recalculate

### Step 5: Unit Placement
1. Divide the space on both sides of the corridor into segments
2. For each segment, determine which unit type to place based on:
   - Available space
   - Target unit mix
   - Target unit sizes
3. Create unit boundaries (demising walls)
4. Apply wall alignment logic to align walls across the corridor
5. Ensure each unit has corridor access and facade access

### Step 6: Metrics Calculation
1. Calculate GSF (total area)
2. Calculate NRSF (sum of all unit areas)
3. Calculate efficiency (NRSF ÷ GSF)
4. Count units of each type
5. Calculate actual unit mix percentages

### Step 7: Generate Variations
Repeat steps 2-6 with different priorities:
- Variation 1: Maximize efficiency
- Variation 2: Match unit mix as closely as possible
- Variation 3: Balance both goals

---

**End of Document**
