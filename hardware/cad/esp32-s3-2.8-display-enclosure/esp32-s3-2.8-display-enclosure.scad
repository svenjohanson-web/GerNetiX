/*
  Parametric enclosure for the Shenzhen Qoboe ESP32-S3 2.8" display board
  Drawing reference: ES3C28P V1.0, 2025-06-11
  3D reference: ES3C28P_3D.step, Open CASCADE model, 2025-06-10

  Export:
    1. Set part to "base" or "lid".
    2. Render with F6 in OpenSCAD.
    3. File -> Export -> Export as STL.

  The default dimensions are derived from the supplied mechanical drawing.
  Verify connector positions on the physical board before the final print.
*/

$fn = 48;
part = "print_plate"; // [print_plate,assembly,base,base_complete,lid,logo]

// Board and display dimensions from the drawing
pcb_size = [86.0, 50.0, 1.599438];
mount_spacing = [78.0, 42.0];
mount_hole_d = 3.2;
display_window = [70.0, 50.4];
display_window_offset = [0.2, 0.0];
display_height_above_pcb = 4.3;
display_recess = 0.3;

// Print and fit parameters
xy_clearance = 0.45;
wall = 2.4;
floor_thickness = 2.4;
corner_radius = 3.5;

// Recessed wordmark on the outside of the enclosure bottom
bottom_logo_enabled = true;
bottom_logo_text = "GerNetiX.com";
bottom_logo_font = "Helvetica:style=Bold";
bottom_logo_size = 7.5;
bottom_logo_depth = 0.6;
bottom_logo_offset = [0.0, 0.0];
bottom_logo_text_offset_y = -9.0;
bottom_logo_symbol_enabled = true;
bottom_logo_symbol_width = 26.0;
bottom_logo_symbol_height = 17.0;
bottom_logo_symbol_offset_y = 5.0;
bottom_logo_symbol_file = "gernetix-book-cloud-cad.svg";

// Centered battery space below the PCB
battery_size = [65.5, 35.5, 10.0];
battery_xy_clearance = 0.75;
battery_space_height = battery_size[2] + 0.5;
battery_tray_wall = 1.4;
battery_tray_height = battery_size[2] + 0.5;
battery_cable_notch_width = 6.0;
battery_cable_notch_y = 8.0;
battery_offset_y = 3.0;

// Small speaker mounted vertically at the south enclosure wall
speaker_size = [15.0, 11.0, 4.0]; // width, height, depth
speaker_clearance = 0.3;
speaker_cradle_wall = 1.6;
speaker_bottom_clearance = 4.5;
speaker_case_extension_y = 0.0;
speaker_offset_x = -25.0;
speaker_board_clearance = 0.2;
speaker_cable_slot_bottom_z = -2.0;
speaker_cable_slot_depth = 3.0;
speaker_grille_count = 5;
speaker_grille_width = 11.0;
speaker_grille_slot_height = 1.2;
speaker_grille_spacing = 2.0;

rear_component_height = 4.7;
rear_component_clearance = 0.8;
pcb_standoff_height =
    battery_space_height +
    rear_component_height +
    rear_component_clearance;

lid_top_thickness = 2.4;
lid_spacer_height =
    display_height_above_pcb +
    display_recess -
    lid_top_thickness;
pcb_bottom_z = floor_thickness + pcb_standoff_height;
base_height =
    pcb_bottom_z +
    pcb_size[2] +
    lid_spacer_height;

boss_outer_d = 6.8;
boss_contact_d = 5.6;
boss_contact_height = 1.0;
board_locator_d = 2.8;
board_locator_height = 1.3;

lid_skirt_height = 7.0;
lid_skirt_wall = 1.6;
lid_fit_clearance = 0.20;
lid_spacer_d = 5.6;

// Tool-free snap connection between lid skirt and enclosure base
snap_bump_radius = 0.8;
snap_bump_length = 8.0;
snap_bump_protrusion = 0.85;
snap_recess_width = 9.0;
snap_recess_height = 2.0;
snap_recess_depth = 0.65;
snap_edge_offset = 1.4;
snap_positions_north = [-25.0, 25.0];
snap_positions_south = [0.0, 25.0];
speaker_lid_relief_width = 12.0;
speaker_lid_relief_height = 3.6;

// USB-C opening in the left short wall, centered as shown in the front view.
usb_opening_enabled = true;
usb_opening_y = 0.0;
usb_connector_width = 8.94;
usb_horizontal_clearance = 2.53;
usb_step_face_height = 3.25;
usb_vertical_clearance = 2.875;
usb_opening_width_reduction = 1.0;
usb_opening_height_reduction = 1.0;
usb_lid_relief_extra_width = 0.0;
usb_opening_width =
    usb_connector_width +
    2 * usb_horizontal_clearance -
    usb_opening_width_reduction;
usb_opening_height =
    usb_step_face_height +
    2 * usb_vertical_clearance -
    usb_opening_height_reduction;
usb_opening_bottom_z =
    pcb_bottom_z -
    usb_step_face_height -
    usb_vertical_clearance +
    usb_opening_height_reduction / 2;
usb_opening_corner_radius = 2.0;
lid_assembly_flip_z = base_height + lid_top_thickness;
usb_lid_relief_center_z =
    lid_assembly_flip_z -
    (
        usb_opening_bottom_z +
        usb_opening_height / 2
    );

inner_size = [
    pcb_size[0] + 2 * xy_clearance,
    pcb_size[1] + 2 * xy_clearance + speaker_case_extension_y
];
speaker_inner_width = speaker_size[0] + 2 * speaker_clearance;
speaker_inner_height = speaker_size[1] + 2 * speaker_clearance;
speaker_inner_depth = speaker_size[2] + 2 * speaker_clearance;
speaker_center_y =
    -inner_size[1] / 2 +
    speaker_inner_depth / 2;
speaker_center_z =
    floor_thickness +
    speaker_bottom_clearance +
    speaker_inner_height / 2;
speaker_top_z = speaker_center_z + speaker_inner_height / 2;
base_outer_size = [
    inner_size[0] + 2 * wall,
    inner_size[1] + 2 * wall
];
lid_outer_size = [
    base_outer_size[0] + 2 * (lid_fit_clearance + lid_skirt_wall),
    base_outer_size[1] + 2 * (lid_fit_clearance + lid_skirt_wall)
];
battery_tray_inner_size = [
    battery_size[0] + 2 * battery_xy_clearance,
    battery_size[1] + 2 * battery_xy_clearance
];
battery_tray_outer_size = [
    battery_tray_inner_size[0] + 2 * battery_tray_wall,
    battery_tray_inner_size[1] + 2 * battery_tray_wall
];

module rounded_box(size, radius) {
    hull() {
        for (x = [-size[0] / 2 + radius, size[0] / 2 - radius])
            for (y = [-size[1] / 2 + radius, size[1] / 2 - radius])
                translate([x, y, 0])
                    cylinder(r = radius, h = size[2]);
    }
}

module mounting_pattern() {
    for (x = [-mount_spacing[0] / 2, mount_spacing[0] / 2])
        for (y = [-mount_spacing[1] / 2, mount_spacing[1] / 2])
            translate([x, y, 0])
                children();
}

module base_boss() {
    cylinder(
        d = boss_outer_d,
        h = pcb_bottom_z - boss_contact_height
    );
    translate([0, 0, pcb_bottom_z - boss_contact_height])
        cylinder(
            d = boss_contact_d,
            h = boss_contact_height
        );
    translate([0, 0, pcb_bottom_z])
        cylinder(
            d = board_locator_d,
            h = board_locator_height
        );
}

module base_snap_recess_y(x, side) {
    translate([
        x,
        side * (
            base_outer_size[1] / 2 -
            snap_recess_depth / 2 +
            0.05
        ),
        base_height -
            lid_skirt_height +
            snap_edge_offset
    ])
        cube(
            [
                snap_recess_width,
                snap_recess_depth + 0.1,
                snap_recess_height
            ],
            center = true
        );
}

module lid_snap_bump_y(x, side) {
    inner_face_y =
        base_outer_size[1] / 2 +
        lid_fit_clearance;
    bump_center_y =
        side * (
            inner_face_y +
            snap_bump_radius -
            snap_bump_protrusion
        );

    translate([
        x,
        bump_center_y,
        lid_top_thickness +
            lid_skirt_height -
            snap_edge_offset
    ])
        rotate([0, 90, 0])
            cylinder(
                r = snap_bump_radius,
                h = snap_bump_length,
                center = true
            );
}

module rounded_side_cut_x(width, height, depth, radius) {
    hull() {
        for (y = [-width / 2 + radius, width / 2 - radius])
            for (z = [-height / 2 + radius, height / 2 - radius])
                translate([0, y, z])
                    rotate([0, 90, 0])
                        cylinder(r = radius, h = depth, center = true);
    }
}

module rounded_side_cut_y(width, height, depth, radius) {
    hull() {
        for (x = [-width / 2 + radius, width / 2 - radius])
            for (z = [-height / 2 + radius, height / 2 - radius])
                translate([x, 0, z])
                    rotate([90, 0, 0])
                        cylinder(r = radius, h = depth, center = true);
    }
}

module bottom_logo_2d() {
    // Mirrored in the model so it reads correctly from underneath.
    mirror([1, 0, 0])
        union() {
            translate([0, bottom_logo_text_offset_y])
                text(
                    bottom_logo_text,
                    size = bottom_logo_size,
                    font = bottom_logo_font,
                    halign = "center",
                    valign = "center"
                );

            if (bottom_logo_symbol_enabled)
                translate([
                    -bottom_logo_symbol_width / 2,
                    bottom_logo_symbol_offset_y -
                        bottom_logo_symbol_height / 2
                ])
                    resize([
                        bottom_logo_symbol_width,
                        bottom_logo_symbol_height
                    ])
                        import(bottom_logo_symbol_file);
        }
}

module bottom_logo_cut() {
    translate([
        bottom_logo_offset[0],
        bottom_logo_offset[1],
        -0.02
    ])
        linear_extrude(height = bottom_logo_depth + 0.02)
            bottom_logo_2d();
}

module bottom_logo_inlay() {
    translate([
        bottom_logo_offset[0],
        bottom_logo_offset[1],
        0
    ])
        linear_extrude(height = bottom_logo_depth)
            bottom_logo_2d();
}

module battery_tray() {
    difference() {
        rounded_box(
            [
                battery_tray_outer_size[0],
                battery_tray_outer_size[1],
                battery_tray_height
            ],
            3.0
        );
        translate([0, 0, -0.05])
            rounded_box(
                [
                    battery_tray_inner_size[0],
                    battery_tray_inner_size[1],
                    battery_tray_height + 0.1
                ],
                3.0 - battery_tray_wall
            );

        // Opening in the retaining rim for the battery cable.
        translate([
            -battery_tray_outer_size[0] / 2,
            battery_cable_notch_y,
            battery_tray_height / 2
        ])
            cube(
                [
                    2 * battery_tray_wall + 0.2,
                    battery_cable_notch_width,
                    battery_tray_height + 0.1
                ],
                center = true
            );

    }
}

module speaker_cradle() {
    cradle_bottom_z = floor_thickness - speaker_center_z;
    cradle_top_z =
        pcb_bottom_z -
        speaker_board_clearance -
        speaker_center_z;
    cradle_side_height = cradle_top_z - cradle_bottom_z;
    cradle_side_center_z =
        (cradle_top_z + cradle_bottom_z) / 2;

    difference() {
        union() {
            for (x = [
                -speaker_inner_width / 2 - speaker_cradle_wall / 2,
                speaker_inner_width / 2 + speaker_cradle_wall / 2
            ])
                translate([x, 0, cradle_side_center_z])
                    cube(
                        [
                            speaker_cradle_wall,
                            speaker_inner_depth + speaker_cradle_wall,
                            cradle_side_height
                        ],
                        center = true
                    );

            // Solid pedestal connects the raised speaker pocket to the enclosure floor.
            pedestal_top_z = -speaker_inner_height / 2;
            pedestal_height = pedestal_top_z - cradle_bottom_z;
            translate([
                0,
                0,
                cradle_bottom_z + pedestal_height / 2
            ])
                cube(
                    [
                        speaker_inner_width + 2 * speaker_cradle_wall,
                        speaker_inner_depth + speaker_cradle_wall,
                        pedestal_height
                    ],
                    center = true
                );

            // Rear plate keeps the speaker against the grille. The top remains open;
            // after installation the PCB edge limits upward movement.
            translate([
                0,
                speaker_inner_depth / 2 + speaker_cradle_wall / 2,
                cradle_side_center_z
            ])
                cube(
                    [
                        speaker_inner_width + 2 * speaker_cradle_wall,
                        speaker_cradle_wall,
                        cradle_side_height
                    ],
                    center = true
                );
        }

        // Open-top cable slot in the right 11 mm side of the speaker.
        cable_slot_top_z = cradle_top_z + 0.2;
        cable_slot_height =
            cable_slot_top_z -
            speaker_cable_slot_bottom_z;
        translate([
            speaker_inner_width / 2 + speaker_cradle_wall / 2,
            0,
            speaker_cable_slot_bottom_z +
                cable_slot_height / 2
        ])
            cube(
                [
                    2 * speaker_cradle_wall + 0.4,
                    speaker_cable_slot_depth,
                    cable_slot_height
                ],
                center = true
            );
    }
}

module base_shell() {
    difference() {
        union() {
            difference() {
                rounded_box(
                    [base_outer_size[0], base_outer_size[1], base_height],
                    corner_radius
                );
                translate([0, 0, floor_thickness])
                    rounded_box(
                        [
                            inner_size[0],
                            inner_size[1],
                            base_height - floor_thickness + 0.1
                        ],
                        max(0.8, corner_radius - wall)
                    );
            }

            mounting_pattern()
                base_boss();

            translate([0, battery_offset_y, floor_thickness])
                battery_tray();

            translate([
                speaker_offset_x,
                speaker_center_y,
                speaker_center_z
            ])
                speaker_cradle();
        }

        if (usb_opening_enabled)
            translate([
                -base_outer_size[0] / 2,
                usb_opening_y,
                usb_opening_bottom_z + usb_opening_height / 2
            ])
                rounded_side_cut_x(
                    usb_opening_width,
                    usb_opening_height,
                    2 * wall + 1.0,
                    usb_opening_corner_radius
                );

        if (bottom_logo_enabled)
            bottom_logo_cut();

        for (index = [
            -(speaker_grille_count - 1) / 2 :
            (speaker_grille_count - 1) / 2
        ])
            translate([
                speaker_offset_x +
                    index * speaker_grille_spacing,
                -base_outer_size[1] / 2,
                speaker_center_z
            ])
                rounded_side_cut_y(
                    speaker_grille_slot_height,
                    speaker_grille_width,
                    2 * wall + 1.0,
                    speaker_grille_slot_height / 2
                );

        for (x = snap_positions_north)
            base_snap_recess_y(x, 1);
        for (x = snap_positions_south)
            base_snap_recess_y(x, -1);
    }
}

// The lid is oriented display-face down for support-free printing.
module lid_print_orientation() {
    difference() {
        union() {
            rounded_box(
                [lid_outer_size[0], lid_outer_size[1], lid_top_thickness],
                corner_radius + lid_fit_clearance + lid_skirt_wall
            );

            // Outer cap skirt: slides over the base without consuming PCB space.
            translate([0, 0, lid_top_thickness])
                difference() {
                    rounded_box(
                        [
                            lid_outer_size[0],
                            lid_outer_size[1],
                            lid_skirt_height
                        ],
                        corner_radius + lid_fit_clearance + lid_skirt_wall
                    );
                    translate([0, 0, -0.05])
                        rounded_box(
                            [
                                base_outer_size[0] + 2 * lid_fit_clearance,
                                base_outer_size[1] + 2 * lid_fit_clearance,
                                lid_skirt_height + 0.1
                            ],
                            corner_radius + lid_fit_clearance
                        );
                }

            // These tubes clamp the PCB between the lid and base standoffs.
            mounting_pattern()
                translate([0, 0, lid_top_thickness])
                    cylinder(d = lid_spacer_d, h = lid_spacer_height);

            // The lid is printed face-down and rotated 180 degrees around X
            // for assembly, so north/south features must be mirrored here.
            for (x = snap_positions_north)
                lid_snap_bump_y(x, -1);
            for (x = snap_positions_south)
                lid_snap_bump_y(x, 1);
        }

        // Center the display opening after using a lower-left cube origin.
        translate([
            display_window_offset[0] - display_window[0] / 2,
            display_window_offset[1] - display_window[1] / 2,
            -0.05
        ])
            cube(
                [
                    display_window[0],
                    display_window[1],
                    lid_top_thickness + 0.1
                ]
            );

        // Matching relief in the overlapping lid skirt for the USB plug/cable.
        if (usb_opening_enabled)
            translate([
                -lid_outer_size[0] / 2,
                usb_opening_y,
                usb_lid_relief_center_z
            ])
                rounded_side_cut_x(
                    usb_opening_width + usb_lid_relief_extra_width,
                    usb_opening_height,
                    2 * lid_skirt_wall + 1.0,
                    usb_opening_corner_radius
                );

        // The longer snap skirt must not cover the upper speaker grille.
        translate([
            speaker_offset_x,
            lid_outer_size[1] / 2,
            lid_top_thickness +
                lid_skirt_height -
                speaker_lid_relief_height / 2
        ])
            cube(
                [
                    speaker_lid_relief_width,
                    2 * lid_skirt_wall + 1.0,
                    speaker_lid_relief_height + 0.1
                ],
                center = true
            );
    }
}

module board_preview() {
    color([0.08, 0.16, 0.13, 0.75])
        translate([
            -pcb_size[0] / 2,
            -pcb_size[1] / 2,
            pcb_bottom_z
        ])
            cube(pcb_size);

    color([0.08, 0.08, 0.09, 0.85])
        translate([
            display_window_offset[0] - 69.2 / 2,
            display_window_offset[1] - 50.0 / 2,
            pcb_bottom_z + pcb_size[2]
        ])
            cube([69.2, 50.0, display_height_above_pcb]);
}

module base_with_logo() {
    base_shell();
    if (bottom_logo_enabled)
        bottom_logo_inlay();
}

module assembly() {
    color("DimGray")
        base_shell();
    if (bottom_logo_enabled)
        color([0.1, 0.55, 0.95])
            bottom_logo_inlay();
    board_preview();
    color([0.15, 0.15, 0.17, 0.82])
        translate([0, 0, base_height + lid_top_thickness])
            rotate([180, 0, 0])
                lid_print_orientation();
}

module print_plate() {
    print_gap = 10.0;
    center_distance =
        base_outer_size[0] / 2 +
        lid_outer_size[0] / 2 +
        print_gap;

    translate([-center_distance / 2, 0, 0])
        base_with_logo();
    translate([center_distance / 2, 0, 0])
        lid_print_orientation();
}

if (part == "print_plate")
    print_plate();
else if (part == "base")
    base_shell();
else if (part == "base_complete")
    base_with_logo();
else if (part == "lid")
    lid_print_orientation();
else if (part == "logo")
    bottom_logo_inlay();
else
    assembly();
