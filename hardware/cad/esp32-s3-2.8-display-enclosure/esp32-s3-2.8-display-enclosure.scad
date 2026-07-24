/*
  Parametric enclosure for the Shenzhen Qoboe ESP32-S3 2.8" display board
  Drawing reference: ES3N28R V1.0, 2025-06-11

  Export:
    1. Set part to "base" or "lid".
    2. Render with F6 in OpenSCAD.
    3. File -> Export -> Export as STL.

  The default dimensions are derived from the supplied mechanical drawing.
  Verify connector positions on the physical board before the final print.
*/

$fn = 48;
part = "print_plate"; // [print_plate,assembly,base,lid]

// Board and display dimensions from the drawing
pcb_size = [86.0, 60.0, 1.6];
mount_spacing = [78.0, 50.0];
mount_hole_d = 3.2;
display_window = [70.0, 50.4];
display_window_offset = [0.2, 0.0];

// Print and fit parameters
xy_clearance = 0.45;
wall = 2.4;
floor_thickness = 2.4;
corner_radius = 3.5;

// Centered battery space below the PCB
battery_size = [65.5, 35.5, 10.0];
battery_xy_clearance = 0.75;
battery_space_height = battery_size[2] + 0.5;
battery_tray_wall = 1.4;
battery_tray_height = battery_size[2] + 0.5;
battery_cable_notch_width = 6.0;
battery_cable_notch_y = 8.0;

base_height = 12.0 + battery_space_height;
pcb_standoff_height = 4.5 + battery_space_height;
boss_outer_d = 6.8;
boss_pilot_d = 2.6;       // M3 self-tapping screw; use 3.2 for a through-hole

lid_top_thickness = 2.4;
lid_skirt_height = 3.5;
lid_skirt_wall = 1.6;
lid_fit_clearance = 0.25;
lid_spacer_d = 6.8;
screw_clearance_d = 3.3;
screw_head_d = 6.2;
screw_head_recess = 1.2;

// USB-C opening in the left short wall, centered as shown in the front view.
usb_opening_enabled = true;
usb_opening_y = 0.0;
usb_opening_width = 14.0;
usb_opening_bottom_z = 5.0 + battery_space_height;
usb_opening_height = 6.0;
usb_opening_corner_radius = 2.0;

inner_size = [
    pcb_size[0] + 2 * xy_clearance,
    pcb_size[1] + 2 * xy_clearance
];
base_outer_size = [
    inner_size[0] + 2 * wall,
    inner_size[1] + 2 * wall
];
lid_outer_size = [
    base_outer_size[0] + 2 * (lid_fit_clearance + lid_skirt_wall),
    base_outer_size[1] + 2 * (lid_fit_clearance + lid_skirt_wall)
];
pcb_bottom_z = floor_thickness + pcb_standoff_height;
lid_spacer_height = base_height - pcb_bottom_z - pcb_size[2];
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

module rounded_side_cut_x(width, height, depth, radius) {
    hull() {
        for (y = [-width / 2 + radius, width / 2 - radius])
            for (z = [-height / 2 + radius, height / 2 - radius])
                translate([0, y, z])
                    rotate([0, 90, 0])
                        cylinder(r = radius, h = depth, center = true);
    }
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
            battery_tray_outer_size[0] / 2,
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
                cylinder(
                    d = boss_outer_d,
                    h = pcb_bottom_z
                );

            translate([0, 0, floor_thickness])
                battery_tray();
        }

        mounting_pattern()
            translate([0, 0, floor_thickness])
                cylinder(
                    d = boss_pilot_d,
                    h = pcb_bottom_z - floor_thickness + 0.2
                );

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

        mounting_pattern() {
            translate([0, 0, -0.05])
                cylinder(
                    d = screw_clearance_d,
                    h = lid_top_thickness + lid_spacer_height + 0.1
                );
            translate([0, 0, -0.05])
                cylinder(
                    d = screw_head_d,
                    h = screw_head_recess + 0.05
                );
        }
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
            cube([69.2, 50.0, 2.3]);
}

module assembly() {
    color("DimGray")
        base_shell();
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
        base_shell();
    translate([center_distance / 2, 0, 0])
        lid_print_orientation();
}

if (part == "print_plate")
    print_plate();
else if (part == "base")
    base_shell();
else if (part == "lid")
    lid_print_orientation();
else
    assembly();
