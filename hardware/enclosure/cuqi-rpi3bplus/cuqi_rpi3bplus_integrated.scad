/*
 * Integrated CUQI 7-inch screen + Raspberry Pi 3B+ enclosure.
 *
 * Part 1, integrated_back:
 *   replaces the original 7i-back.stl part;
 *   retains its screen interface and four M3 mounting locations;
 *   adds the Pi mounting posts and the enclosure side walls.
 *
 * Part 2, rear_lid:
 *   removable ventilated service lid, held by four short M3 screws.
 *
 * This remains a prototype until cable and connector clearances are
 * checked against the physical screen.
 */

$fn = 48;

part = 0; // 0 preview, 1 integrated back, 2 rear lid, 3 exploded preview

case_x_min = -7.8;
case_x_max = 164.8;
case_z_min = -122.8;
case_z_max = 7.8;
case_radius = 8;

wall = 2.4;
body_depth = 25.5;
lid_depth = 3.0;

pi_board_x = 56;
pi_board_z = 85;
pi_x_min = 50.5;
pi_z_max = -15;
pi_mount_y = 4.5;
pi_insert_diameter = 3.2;
pi_insert_depth = 4.0;
pi_pilot_diameter = 2.0;

lid_bosses = [
    [0.5, -114.5],
    [156.5, -114.5],
    [0.5, -0.5],
    [156.5, -0.5]
];

// Large opening first, then a 10 mm upward slide onto the screw shank.
panel_keyholes = [
    [24, -23],
    [133, -23]
];
panel_keyhole_slide = 10;
panel_screw_head_diameter = 8.6;
panel_screw_shank_diameter = 4.4;

module rounded_prism_y(x_min, x_max, z_min, z_max, y_min, y_max, radius) {
    hull() {
        for (x = [x_min + radius, x_max - radius])
            for (z = [z_min + radius, z_max - radius])
                translate([x, y_min, z])
                    rotate([-90, 0, 0])
                        cylinder(h = y_max - y_min, r = radius);
    }
}

module original_front() {
    color([0.08, 0.23, 0.62])
        import("../cuqi-7inch-original/7i-front.stl", convexity = 10);
}

module original_back_interface() {
    import("../cuqi-7inch-original/7i-back.stl", convexity = 10);
}

module side_walls() {
    difference() {
        rounded_prism_y(
            case_x_min, case_x_max,
            case_z_min, case_z_max,
            -0.8, body_depth,
            case_radius
        );

        // Open interior. The imported CUQI back remains the screen/Pi divider.
        rounded_prism_y(
            case_x_min + wall, case_x_max - wall,
            case_z_min + wall, case_z_max - wall,
            -1, body_depth + 0.2,
            case_radius - wall
        );

        // Bottom access to Ethernet and both USB connector stacks.
        translate([pi_x_min - 2, 4, case_z_min - 1])
            cube([pi_board_x + 4, 21, 14]);

        // Side service opening for the short HDMI/touch leads and power.
        translate([case_x_max - wall - 0.2, 4, pi_z_max - pi_board_z + 14])
            cube([wall + 0.4, 21, 53]);
    }
}

module pi_standoffs() {
    // 58 x 49 mm Pi hole pattern, rotated so Ethernet points downward.
    // Each post receives an M2.5 heat-set brass insert from its open end.
    for (x = [pi_x_min + 3.5, pi_x_min + 52.5])
        for (z = [pi_z_max - 3.5, pi_z_max - 61.5])
            difference() {
                translate([x, -0.3, z])
                    rotate([-90, 0, 0])
                        cylinder(h = pi_mount_y + 0.3, r = 3.5);

                // Narrow blind pilot prevents the insert pocket from bottoming
                // on trapped air and gives the screw a little extra clearance.
                translate([x, -0.4, z])
                    rotate([-90, 0, 0])
                        cylinder(
                            h = pi_mount_y - pi_insert_depth + 0.5,
                            r = pi_pilot_diameter / 2
                        );

                // Insert pocket, open toward the Pi.
                translate([x, pi_mount_y - pi_insert_depth, z])
                    rotate([-90, 0, 0])
                        cylinder(
                            h = pi_insert_depth + 0.2,
                            r1 = pi_insert_diameter / 2 - 0.08,
                            r2 = pi_insert_diameter / 2
                        );
            }
}

module lid_insert_boss(x, z) {
    // Rear-local boss for an M3 heat-set insert and a short lid screw.
    difference() {
        hull() {
            translate([x, body_depth - 6, z])
                rotate([-90, 0, 0])
                    cylinder(h = 6, r = 3.8);
            translate([
                x < (case_x_min + case_x_max) / 2 ? case_x_min + wall : case_x_max - wall,
                body_depth - 6,
                z
            ])
                rotate([-90, 0, 0])
                    cylinder(h = 6, r = 2.2);
        }
        translate([x, body_depth - 6.2, z])
            rotate([-90, 0, 0])
                cylinder(h = 6.4, r = 2.15);
    }
}

module integrated_back() {
    color([0.25, 0.27, 0.30])
    union() {
        original_back_interface();
        side_walls();
        pi_standoffs();
        for (position = lid_bosses)
            lid_insert_boss(position[0], position[1]);
    }
}

module lid_vent(x, z) {
    translate([x, body_depth - 0.2, z])
        rotate([-90, 0, 0])
            hull() {
                translate([-8, 0, 0]) cylinder(h = lid_depth + 0.4, r = 1.35);
                translate([ 8, 0, 0]) cylinder(h = lid_depth + 0.4, r = 1.35);
            }
}

module keyhole_reinforcement(x, z) {
    hull() {
        for (keyhole_z = [z, z + panel_keyhole_slide])
            translate([x, body_depth - 1.8, keyhole_z])
                rotate([-90, 0, 0])
                    cylinder(h = 2.0, r = 7);
    }
}

module keyhole_cut(x, z) {
    translate([x, body_depth - 2, z])
        rotate([-90, 0, 0])
            cylinder(h = lid_depth + 4, r = panel_screw_head_diameter / 2);

    hull() {
        for (keyhole_z = [z, z + panel_keyhole_slide])
            translate([x, body_depth - 2, keyhole_z])
                rotate([-90, 0, 0])
                    cylinder(h = lid_depth + 4, r = panel_screw_shank_diameter / 2);
    }
}

module rear_lid() {
    difference() {
        union() {
            rounded_prism_y(
                case_x_min, case_x_max,
                case_z_min, case_z_max,
                body_depth, body_depth + lid_depth,
                case_radius
            );

            // Local material increase around the two panel mounting slots.
            for (position = panel_keyholes)
                keyhole_reinforcement(position[0], position[1]);
        }

        for (position = lid_bosses)
            translate([position[0], body_depth - 0.2, position[1]])
                rotate([-90, 0, 0])
                    cylinder(h = lid_depth + 0.4, r = 1.7);

        for (z = [-101, -92, -83, -74, -65, -56, -47, -38])
            lid_vent(130, z);

        for (position = panel_keyholes)
            keyhole_cut(position[0], position[1]);
    }
}

module pi_mockup() {
    color([0.08, 0.48, 0.19])
        translate([pi_x_min, pi_mount_y, pi_z_max - pi_board_z])
            cube([pi_board_x, 1.6, pi_board_z]);

    color([0.72, 0.74, 0.76]) {
        translate([pi_x_min + 2, pi_mount_y + 1.6, pi_z_max - pi_board_z - 5])
            cube([17, 14, 20]);
        translate([pi_x_min + 21, pi_mount_y + 1.6, pi_z_max - pi_board_z - 5])
            cube([16, 16, 18]);
        translate([pi_x_min + 39, pi_mount_y + 1.6, pi_z_max - pi_board_z - 5])
            cube([16, 16, 18]);
    }

    color([0.16, 0.18, 0.20])
        translate([pi_x_min + 7, pi_mount_y + 1.6, pi_z_max - pi_board_z + 22])
            cube([42, 12, 48]);
}

module preview(exploded = false) {
    original_front();
    integrated_back();
    pi_mockup();
    translate([0, exploded ? 14 : 0, 0])
        color([0.78, 0.35, 0.10, 0.70])
            rear_lid();
}

if (part == 1) {
    integrated_back();
} else if (part == 2) {
    rear_lid();
} else if (part == 3) {
    preview(true);
} else {
    preview(false);
}
