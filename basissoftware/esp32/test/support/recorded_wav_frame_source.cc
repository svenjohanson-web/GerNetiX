#include "recorded_wav_frame_source.h"

#include <algorithm>
#include <cstring>

namespace {

uint16_t readLe16(const unsigned char* bytes) {
  return static_cast<uint16_t>(bytes[0]) |
      static_cast<uint16_t>(bytes[1] << 8);
}

uint32_t readLe32(const unsigned char* bytes) {
  return static_cast<uint32_t>(bytes[0]) |
      (static_cast<uint32_t>(bytes[1]) << 8) |
      (static_cast<uint32_t>(bytes[2]) << 16) |
      (static_cast<uint32_t>(bytes[3]) << 24);
}

}  // namespace

namespace nexi_test {

RecordedWavFrameSource::RecordedWavFrameSource(const char* path)
    : stream_(path, std::ios::binary),
      samples_(),
      dataBytesRemaining_(0),
      sequence_(0),
      error_(RecordedWavError::None) {
  if (!stream_.is_open()) {
    error_ = RecordedWavError::CannotOpen;
    return;
  }
  parseHeader();
}

bool RecordedWavFrameSource::read(nexi::AudioFrame* frame) {
  if (frame == nullptr || !valid() || dataBytesRemaining_ == 0) return false;

  const uint32_t wantedBytes = std::min<uint32_t>(
      dataBytesRemaining_,
      static_cast<uint32_t>(samples_.size() * sizeof(int16_t)));
  if ((wantedBytes % sizeof(int16_t)) != 0 ||
      !readExact(reinterpret_cast<char*>(samples_.data()), wantedBytes)) {
    error_ = RecordedWavError::TruncatedAudioData;
    return false;
  }

  dataBytesRemaining_ -= wantedBytes;
  *frame = nexi::AudioFrame{
      samples_.data(), wantedBytes / sizeof(int16_t), sequence_++};
  return true;
}

bool RecordedWavFrameSource::valid() const {
  return error_ == RecordedWavError::None;
}

RecordedWavError RecordedWavFrameSource::error() const { return error_; }

bool RecordedWavFrameSource::parseHeader() {
  unsigned char riff[12] = {};
  if (!readExact(reinterpret_cast<char*>(riff), sizeof(riff)) ||
      std::memcmp(riff, "RIFF", 4) != 0 ||
      std::memcmp(riff + 8, "WAVE", 4) != 0) {
    error_ = RecordedWavError::InvalidContainer;
    return false;
  }

  bool formatFound = false;
  while (stream_.good()) {
    unsigned char chunkHeader[8] = {};
    if (!readExact(reinterpret_cast<char*>(chunkHeader), sizeof(chunkHeader))) {
      break;
    }
    const uint32_t chunkSize = readLe32(chunkHeader + 4);

    if (std::memcmp(chunkHeader, "fmt ", 4) == 0) {
      if (chunkSize < 16) {
        error_ = RecordedWavError::UnsupportedFormat;
        return false;
      }
      unsigned char format[16] = {};
      if (!readExact(reinterpret_cast<char*>(format), sizeof(format))) {
        error_ = RecordedWavError::InvalidContainer;
        return false;
      }
      const bool supported = readLe16(format) == 1 &&
          readLe16(format + 2) == 1 &&
          readLe32(format + 4) == nexi::kWakeAudioSampleRateHz &&
          readLe16(format + 12) == sizeof(int16_t) &&
          readLe16(format + 14) == 16;
      if (!supported) {
        error_ = RecordedWavError::UnsupportedFormat;
        return false;
      }
      formatFound = true;
      const std::streamoff remaining = static_cast<std::streamoff>(chunkSize - 16);
      if (remaining > 0) stream_.seekg(remaining, std::ios::cur);
    } else if (std::memcmp(chunkHeader, "data", 4) == 0) {
      if (!formatFound || chunkSize == 0 || (chunkSize % sizeof(int16_t)) != 0) {
        error_ = formatFound ? RecordedWavError::MissingAudioData
                             : RecordedWavError::UnsupportedFormat;
        return false;
      }
      dataBytesRemaining_ = chunkSize;
      return true;
    } else {
      stream_.seekg(static_cast<std::streamoff>(chunkSize), std::ios::cur);
    }

    if ((chunkSize & 1U) != 0) stream_.seekg(1, std::ios::cur);
  }

  error_ = formatFound ? RecordedWavError::MissingAudioData
                       : RecordedWavError::UnsupportedFormat;
  return false;
}

bool RecordedWavFrameSource::readExact(char* target, std::streamsize size) {
  stream_.read(target, size);
  return stream_.gcount() == size;
}

}  // namespace nexi_test
