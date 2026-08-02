Import("env")

from os.path import join

project_dir = env.subst("$PROJECT_DIR")
build_dir = env.subst("$BUILD_DIR")
game_source_dir = join(project_dir, "lib", "game_collection", "src")
u8g2_source_dir = join(project_dir, ".pio", "libdeps", env.subst("$PIOENV"), "U8g2", "src")

env.Append(CPPPATH=[game_source_dir, u8g2_source_dir])
env.BuildSources(join(build_dir, "game_collection"), game_source_dir)
