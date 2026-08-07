#pragma once

#include <cstddef>
#include <cstdint>

namespace nexi {

struct RtcCalendarTime {
  uint16_t year;
  uint8_t month;
  uint8_t day;
  uint8_t hour;
  uint8_t minute;
  uint8_t second;
};

class Pcf85063TimeCodec {
 public:
  static constexpr size_t kRegisterCount = 7;
  static constexpr uint64_t kFallbackEpochSeconds = 946684800ULL;

  static bool valid(const RtcCalendarTime& time);
  static bool decode(const uint8_t* registers, size_t size,
      RtcCalendarTime* time, bool* oscillatorStopped);
  static bool encode(const RtcCalendarTime& time,
      uint8_t* registers, size_t capacity);
  static bool toEpochSeconds(const RtcCalendarTime& time, uint64_t* seconds);
  static bool fromEpochSeconds(uint64_t seconds, RtcCalendarTime* time);
};

}  // namespace nexi
