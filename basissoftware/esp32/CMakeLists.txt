cmake_minimum_required(VERSION 3.16.0)

if(DEFINED ENV{GERNETIX_PROJECT_COMPONENT})
  list(APPEND EXTRA_COMPONENT_DIRS "$ENV{GERNETIX_PROJECT_COMPONENT}")
endif()

# PlatformIO forwards project-specific CMake arguments, while the remote build
# service supplies the same path as an environment variable.  Both routes use
# the identical component contract.
if(DEFINED GERNETIX_PROJECT_COMPONENT)
  list(APPEND EXTRA_COMPONENT_DIRS "${GERNETIX_PROJECT_COMPONENT}")
endif()

if(DEFINED ENV{GERNETIX_GENERATED_COMPONENT})
  list(APPEND EXTRA_COMPONENT_DIRS "$ENV{GERNETIX_GENERATED_COMPONENT}")
endif()

include($ENV{IDF_PATH}/tools/cmake/project.cmake)
set(PROJECT_VER "0.1.0")
project(gernetix-esp32-basissoftware)
