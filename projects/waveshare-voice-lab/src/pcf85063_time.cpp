#include "nexi/pcf85063_time.h"

namespace nexi {
namespace {
constexpr uint8_t kOscillatorStopMask = 0x80;
constexpr uint16_t kFirstYear = 2000;
constexpr uint16_t kLastYear = 2099;

bool leap(uint16_t year) {
  return year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
}

uint8_t daysInMonth(uint16_t year, uint8_t month) {
  static const uint8_t days[] = {
      31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31};
  if (month == 0 || month > 12) return 0;
  return month == 2 && leap(year) ? 29 : days[month - 1];
}

bool decodeBcd(uint8_t value, uint8_t mask, uint8_t maximum, uint8_t* output) {
  if (output == nullptr || (value & static_cast<uint8_t>(~mask)) != 0) {
    return false;
  }
  const uint8_t masked = value & mask;
  const uint8_t low = masked & 0x0f;
  const uint8_t high = masked >> 4;
  if (low > 9 || high > 9) return false;
  const uint8_t decoded = static_cast<uint8_t>(high * 10 + low);
  if (decoded > maximum) return false;
  *output = decoded;
  return true;
}

uint8_t encodeBcd(uint8_t value) {
  return static_cast<uint8_t>(((value / 10) << 4) | (value % 10));
}
}  // namespace

bool Pcf85063TimeCodec::valid(const RtcCalendarTime& time) {
  return time.year >= kFirstYear && time.year <= kLastYear &&
      time.month >= 1 && time.month <= 12 && time.day >= 1 &&
      time.day <= daysInMonth(time.year, time.month) && time.hour <= 23 &&
      time.minute <= 59 && time.second <= 59;
}

bool Pcf85063TimeCodec::decode(const uint8_t* registers, size_t size,
    RtcCalendarTime* time, bool* oscillatorStopped) {
  if (registers == nullptr || time == nullptr || oscillatorStopped == nullptr ||
      size != kRegisterCount) {
    return false;
  }
  *oscillatorStopped = (registers[0] & kOscillatorStopMask) != 0;
  uint8_t second = 0;
  uint8_t minute = 0;
  uint8_t hour = 0;
  uint8_t day = 0;
  uint8_t weekday = 0;
  uint8_t month = 0;
  uint8_t year = 0;
  if (!decodeBcd(registers[0] & 0x7f, 0x7f, 59, &second) ||
      !decodeBcd(registers[1], 0x7f, 59, &minute) ||
      !decodeBcd(registers[2], 0x3f, 23, &hour) ||
      !decodeBcd(registers[3], 0x3f, 31, &day) ||
      !decodeBcd(registers[4], 0x07, 6, &weekday) ||
      !decodeBcd(registers[5], 0x1f, 12, &month) ||
      !decodeBcd(registers[6], 0xff, 99, &year)) {
    return false;
  }
  const RtcCalendarTime decoded = {
      static_cast<uint16_t>(kFirstYear + year), month, day,
      hour, minute, second};
  if (!valid(decoded)) return false;
  *time = decoded;
  return true;
}

bool Pcf85063TimeCodec::encode(const RtcCalendarTime& time,
    uint8_t* registers, size_t capacity) {
  if (registers == nullptr || capacity < kRegisterCount || !valid(time)) {
    return false;
  }
  uint64_t epoch = 0;
  if (!toEpochSeconds(time, &epoch)) return false;
  const uint64_t days = (epoch - kFallbackEpochSeconds) / 86400ULL;
  registers[0] = encodeBcd(time.second);
  registers[1] = encodeBcd(time.minute);
  registers[2] = encodeBcd(time.hour);
  registers[3] = encodeBcd(time.day);
  registers[4] = static_cast<uint8_t>(days % 7ULL);
  registers[5] = encodeBcd(time.month);
  registers[6] = encodeBcd(static_cast<uint8_t>(time.year - kFirstYear));
  return true;
}

bool Pcf85063TimeCodec::toEpochSeconds(
    const RtcCalendarTime& time, uint64_t* seconds) {
  if (seconds == nullptr || !valid(time)) return false;
  uint64_t days = 0;
  for (uint16_t year = kFirstYear; year < time.year; ++year) {
    days += leap(year) ? 366 : 365;
  }
  for (uint8_t month = 1; month < time.month; ++month) {
    days += daysInMonth(time.year, month);
  }
  days += time.day - 1;
  *seconds = kFallbackEpochSeconds + days * 86400ULL +
      static_cast<uint64_t>(time.hour) * 3600ULL +
      static_cast<uint64_t>(time.minute) * 60ULL + time.second;
  return true;
}

bool Pcf85063TimeCodec::fromEpochSeconds(
    uint64_t seconds, RtcCalendarTime* time) {
  if (time == nullptr || seconds < kFallbackEpochSeconds) return false;
  uint64_t remaining = seconds - kFallbackEpochSeconds;
  uint64_t days = remaining / 86400ULL;
  remaining %= 86400ULL;
  uint16_t year = kFirstYear;
  while (year <= kLastYear) {
    const uint16_t yearDays = leap(year) ? 366 : 365;
    if (days < yearDays) break;
    days -= yearDays;
    ++year;
  }
  if (year > kLastYear) return false;
  uint8_t month = 1;
  while (month <= 12) {
    const uint8_t monthDays = daysInMonth(year, month);
    if (days < monthDays) break;
    days -= monthDays;
    ++month;
  }
  if (month > 12) return false;
  *time = {year, month, static_cast<uint8_t>(days + 1),
      static_cast<uint8_t>(remaining / 3600ULL),
      static_cast<uint8_t>((remaining % 3600ULL) / 60ULL),
      static_cast<uint8_t>(remaining % 60ULL)};
  return true;
}

}  // namespace nexi
