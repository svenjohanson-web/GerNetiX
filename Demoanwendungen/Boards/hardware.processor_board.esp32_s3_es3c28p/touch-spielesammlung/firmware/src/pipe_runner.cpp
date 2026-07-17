#include "pipe_runner.h"

#include "sound_driver.h"

#include <cstdio>

namespace {
struct Node { int16_t x; int16_t y; };
struct Edge { uint8_t from; uint8_t to; };

constexpr Node nodes[] = {
    {32, 62}, {96, 62}, {160, 62}, {204, 62},
    {32, 112}, {96, 112}, {160, 112}, {204, 112},
    {32, 174}, {96, 174}, {160, 174}, {204, 174},
};
constexpr Edge edges[] = {
    {0, 1}, {1, 2}, {2, 3}, {0, 4}, {1, 5}, {2, 6}, {3, 7},
    {4, 5}, {5, 6}, {6, 7}, {4, 8}, {5, 9}, {6, 10}, {7, 11},
    {8, 9}, {9, 10}, {10, 11},
};
constexpr uint8_t plugTargets[] = {2, 5, 6, 9, 10};

bool isNeighbor(uint8_t first, uint8_t second) {
  for (const auto& edge : edges) {
    if ((edge.from == first && edge.to == second) || (edge.from == second && edge.to == first)) return true;
  }
  return false;
}

void drawPipe(BoardAdapter& board, const Node& first, const Node& second) {
  board.line(first.x, first.y, second.x, second.y, BoardAdapter::brandAccent);
  if (first.x == second.x) {
    board.line(first.x - 2, first.y, second.x - 2, second.y, BoardAdapter::white);
    board.line(first.x + 2, first.y, second.x + 2, second.y, BoardAdapter::white);
  } else {
    board.line(first.x, first.y - 2, second.x, second.y - 2, BoardAdapter::white);
    board.line(first.x, first.y + 2, second.x, second.y + 2, BoardAdapter::white);
  }
}

void drawForeman(BoardAdapter& board, const Node& node) {
  board.circle(node.x, node.y - 2, 7, BoardAdapter::yellow);
  board.rectangle(node.x - 6, node.y + 4, 12, 10, BoardAdapter::yellow);
  board.rectangle(node.x + 6, node.y + 6, 7, 3, BoardAdapter::white);
}
}  // namespace

void PipeRunner::resetRound(bool keepProgress) {
  foremanNode_ = 0;
  plugNode_ = -1;
  laddermanY_ = 238;
  tickFrames_ = leakFrames_ = intruderFrames_ = 0;
  if (!keepProgress) {
    water_ = 48;
    lives_ = 3;
    pipeLevel_ = 1;
    score_ = 0;
    plugSequence_ = 0;
  }
}

void PipeRunner::reset(SoundDriver& sound) {
  sound_ = &sound;
  running_ = true;
  resetRound(false);
  sound_->play(SoundEffect::gameStart);
}

bool PipeRunner::moveForeman(int direction) {
  const Node current = nodes[foremanNode_];
  for (uint8_t node = 0; node < nodeCount; ++node) {
    if (!isNeighbor(foremanNode_, node)) continue;
    const Node candidate = nodes[node];
    if ((direction == 0 && candidate.x < current.x) || (direction == 1 && candidate.x > current.x) ||
        (direction == 2 && candidate.y < current.y) || (direction == 3 && candidate.y > current.y)) {
      foremanNode_ = node;
      repairLeakIfPresent();
      if (sound_) sound_->play(SoundEffect::move);
      return true;
    }
  }
  return false;
}

void PipeRunner::touch(const TouchPoint& point) {
  if (!running_) {
    if (sound_) reset(*sound_);
    return;
  }
  if (point.y >= 236 && point.y < 268 && point.x >= 88 && point.x <= 152) moveForeman(2);
  else if (point.y >= 268 && point.x < 82) moveForeman(0);
  else if (point.y >= 268 && point.x >= 82 && point.x <= 146) moveForeman(3);
  else if (point.y >= 268 && point.x >= 146 && point.x < 180) moveForeman(1);
  else if (point.y >= 268 && point.x >= 180 && laddermanY_ < 238) {
    laddermanY_ = 238;
    score_ += 25;
    if (sound_) sound_->play(SoundEffect::brick);
  }
}

void PipeRunner::repairLeakIfPresent() {
  if (plugNode_ != static_cast<int8_t>(foremanNode_)) return;
  plugNode_ = -1;
  leakFrames_ = 0;
  score_ += 100;
  if (sound_) sound_->play(SoundEffect::collect);
}

void PipeRunner::tick() {
  if (!running_) return;
  // Lecks sind die Hauptaufgabe: ungefähr alle fünf Sekunden entsteht eines.
  // Der Spieler muss es mit dem gelben Vorarbeiter erreichen und reparieren.
  if (plugNode_ < 0 && ++leakFrames_ >= 40) {
    leakFrames_ = 0;
    plugNode_ = plugTargets[plugSequence_++ % (sizeof(plugTargets) / sizeof(plugTargets[0]))];
    if (sound_) sound_->play(SoundEffect::hit);
  }
  if (++tickFrames_ >= 3) {
    tickFrames_ = 0;
    if (plugNode_ < 0) {
      if (water_ < 100) ++water_;
      if (water_ == 100) {
        ++pipeLevel_;
        score_ += 500;
        water_ = 48;
        if (sound_) sound_->play(SoundEffect::gameStart);
      }
    } else if (water_ > 0) {
      --water_;
      if (water_ == 0) {
        if (--lives_ == 0) {
          running_ = false;
          if (sound_) sound_->play(SoundEffect::gameOver);
        } else {
          water_ = 48;
          plugNode_ = -1;
          foremanNode_ = 0;
          if (sound_) sound_->play(SoundEffect::lifeLost);
        }
      }
    }
  }
  const uint8_t climbInterval = pipeLevel_ > 6 ? 2 : static_cast<uint8_t>(7 - pipeLevel_ / 2);
  if (++intruderFrames_ >= climbInterval) {
    intruderFrames_ = 0;
    laddermanY_ -= 4;
    if (laddermanY_ <= 48) {
      laddermanY_ = 238;
      if (plugNode_ < 0) {
        plugNode_ = plugTargets[plugSequence_++ % (sizeof(plugTargets) / sizeof(plugTargets[0]))];
        leakFrames_ = 0;
        if (sound_) sound_->play(SoundEffect::hit);
      }
    }
  }
}

void PipeRunner::render(BoardAdapter& board) const {
  board.clear(BoardAdapter::brandNavy);
  board.titleBar(BoardAdapter::brandBlue);
  board.text("PIPE CREW", 8, 10, BoardAdapter::white, 1);
  char status[32];
  std::snprintf(status, sizeof(status), "W:%u%% L:%u", water_, lives_);
  board.text(status, 164, 10, BoardAdapter::brandAccent, 1);
  board.text("ZIEL: TANK FUELLEN - ROTE LECKS REPARIEREN", 8, 34, BoardAdapter::white, 1);
  for (const auto& edge : edges) drawPipe(board, nodes[edge.from], nodes[edge.to]);
  for (uint8_t node = 0; node < nodeCount; ++node) board.circle(nodes[node].x, nodes[node].y, 4, BoardAdapter::brandBlue);
  if (plugNode_ >= 0) {
    const Node plug = nodes[plugNode_];
    board.rectangle(plug.x - 7, plug.y - 6, 14, 12, BoardAdapter::red);
    board.text("X", plug.x - 3, plug.y - 5, BoardAdapter::white, 1);
    board.text("LECK", plug.x - 12, plug.y - 18, BoardAdapter::red, 1);
  }
  drawForeman(board, nodes[foremanNode_]);
  board.text("DU", nodes[foremanNode_].x - 6, nodes[foremanNode_].y + 16, BoardAdapter::yellow, 1);
  board.line(224, 42, 224, 228, BoardAdapter::yellow);
  for (int y = 48; y < 228; y += 12) board.line(220, y, 228, y, BoardAdapter::yellow);
  board.circle(224, laddermanY_, 6, BoardAdapter::red);
  board.rectangle(8, 208, 18, 30, BoardAdapter::brandBlue);
  board.rectangle(8, 208, 18, 30, BoardAdapter::white);
  const int waterHeight = water_ / 4;
  board.rectangle(11, 235 - waterHeight, 12, waterHeight, BoardAdapter::brandAccent);
  board.text("W", 10, 212, BoardAdapter::white, 1);
  board.roundedRectangle(98, 236, 44, 26, 5, BoardAdapter::brandBlue);
  board.roundedRectangle(22, 270, 44, 30, 5, BoardAdapter::brandBlue);
  board.roundedRectangle(76, 270, 44, 30, 5, BoardAdapter::brandBlue);
  board.roundedRectangle(130, 270, 44, 30, 5, BoardAdapter::brandBlue);
  board.roundedRectangle(184, 270, 48, 30, 5, BoardAdapter::red);
  board.text("^", 112, 238, BoardAdapter::white, 2);
  board.text("<", 36, 274, BoardAdapter::white, 2);
  board.text("v", 90, 274, BoardAdapter::white, 2);
  board.text(">", 144, 274, BoardAdapter::white, 2);
  board.text("F", 202, 276, BoardAdapter::white, 2);
  board.text("F: LEITER STOPP", 132, 244, BoardAdapter::white, 1);
  if (!running_) {
    board.roundedRectangle(25, 118, 190, 74, 8, BoardAdapter::brandBlue);
    board.text("PIPE STOPPT", 48, 136, BoardAdapter::white, 2);
    board.text("Antippen: Neustart", 51, 168, BoardAdapter::brandAccent, 1);
  }
  board.present();
}
