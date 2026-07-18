#include "pac_maze.h"

#include "sound_driver.h"

#include <cstdio>

namespace {
constexpr char maze[15][20] = {
    "###################",
    "#o.....#...#.....o#",
    "#.###.#.#.#.#.###.#",
    "#.....#.#.#.#.....#",
    "###.#.###.###.#.###",
    "#...#....#....#...#",
    "#.#####...#####.#.#",
    "#.......#.......#.#",
    "#.#####...#####.#.#",
    "#...#....#....#...#",
    "###.#.###.###.#.###",
    "#.....#.#.#.#.....#",
    "#.###.#.#.#.#.###.#",
    "#o.....#...#.....o#",
    "###################",
};
constexpr int cell = 12;
constexpr int offsetX = 6;
constexpr int offsetY = 46;

int deltaX(int direction) { return direction == 0 ? -1 : (direction == 1 ? 1 : 0); }
int deltaY(int direction) { return direction == 2 ? -1 : (direction == 3 ? 1 : 0); }

void drawGhost(BoardAdapter& board, int x, int y, uint16_t color, bool frightened) {
  const int centerX = offsetX + x * cell + cell / 2;
  const int centerY = offsetY + y * cell + cell / 2;
  const uint16_t bodyColor = frightened ? BoardAdapter::brandAccent : color;
  board.circle(centerX, centerY - 2, 5, bodyColor);
  board.rectangle(centerX - 5, centerY - 2, 10, 6, bodyColor);
  board.circle(centerX - 2, centerY - 2, 1, BoardAdapter::white);
  board.circle(centerX + 2, centerY - 2, 1, BoardAdapter::white);
}
}  // namespace

bool PacMaze::isWall(int x, int y) const {
  return x < 0 || y < 0 || x >= columns || y >= rows || maze[y][x] == '#';
}

bool PacMaze::move(int8_t& x, int8_t& y, int direction) const {
  const int nextX = x + deltaX(direction);
  const int nextY = y + deltaY(direction);
  if (isWall(nextX, nextY)) return false;
  x = static_cast<int8_t>(nextX);
  y = static_cast<int8_t>(nextY);
  return true;
}

void PacMaze::resetPositions() {
  // A free corridor and a short grace period prevent an unavoidable hit at spawn.
  pacX_ = 7;
  pacY_ = 7;
  currentDirection_ = wantedDirection_ = 0;
  ghosts_[0] = {7, 6, 7, 6, 1, BoardAdapter::red};
  ghosts_[1] = {8, 6, 8, 6, 0, BoardAdapter::brandAccent};
  ghosts_[2] = {9, 6, 9, 6, 1, BoardAdapter::green};
  ghosts_[3] = {11, 7, 11, 7, 0, BoardAdapter::yellow};
  pacFrames_ = ghostFrames_ = 0;
  powerFrames_ = 0;
  spawnProtectionFrames_ = 16;
}

void PacMaze::reset(SoundDriver& sound) {
  sound_ = &sound;
  score_ = 0;
  lives_ = 3;
  running_ = true;
  won_ = false;
  for (uint8_t y = 0; y < rows; ++y) {
    for (uint8_t x = 0; x < columns; ++x) {
      pellets_[y][x] = maze[y][x] == '.';
      powerPellets_[y][x] = maze[y][x] == 'o';
    }
  }
  resetPositions();
  pellets_[pacY_][pacX_] = false;
  sound_->play(SoundEffect::gameStart);
}

void PacMaze::touch(const TouchPoint& point) {
  if (!running_ || won_) {
    if (sound_) reset(*sound_);
    return;
  }
  if (point.y >= 236 && point.y < 268 && point.x >= 88 && point.x <= 152) wantedDirection_ = 2;
  else if (point.y >= 268 && point.x < 82) wantedDirection_ = 0;
  else if (point.y >= 268 && point.x >= 82 && point.x <= 146) wantedDirection_ = 3;
  else if (point.y >= 268 && point.x >= 146) wantedDirection_ = 1;
}

void PacMaze::collideWithGhosts() {
  for (auto& ghost : ghosts_) {
    if (ghost.x != pacX_ || ghost.y != pacY_) continue;
    if (powerFrames_ > 0) {
      ghost.x = ghost.homeX;
      ghost.y = ghost.homeY;
      score_ += 200;
      if (sound_) sound_->play(SoundEffect::collect);
    } else if (--lives_ == 0) {
      running_ = false;
      if (sound_) sound_->play(SoundEffect::gameOver);
    } else {
      resetPositions();
      if (sound_) sound_->play(SoundEffect::lifeLost);
    }
    return;
  }
}

void PacMaze::tick() {
  if (!running_ || won_) return;
  if (powerFrames_ > 0) --powerFrames_;
  if (spawnProtectionFrames_ > 0) --spawnProtectionFrames_;
  if (++pacFrames_ >= 2) {
    pacFrames_ = 0;
    int8_t nextX = pacX_;
    int8_t nextY = pacY_;
    if (move(nextX, nextY, wantedDirection_)) currentDirection_ = wantedDirection_;
    if (move(pacX_, pacY_, currentDirection_)) {
      if (pellets_[pacY_][pacX_]) {
        pellets_[pacY_][pacX_] = false;
        score_ += 10;
        if (sound_) sound_->play(SoundEffect::collect);
      }
      if (powerPellets_[pacY_][pacX_]) {
        powerPellets_[pacY_][pacX_] = false;
        score_ += 50;
        powerFrames_ = 70;
        if (sound_) sound_->play(SoundEffect::gameStart);
      }
    }
    collideWithGhosts();
  }
  if (spawnProtectionFrames_ == 0 && ++ghostFrames_ >= 3) {
    ghostFrames_ = 0;
    for (uint8_t index = 0; index < 4; ++index) {
      auto& ghost = ghosts_[index];
      int bestDirection = -1;
      int bestDistance = powerFrames_ > 0 ? -1 : 999;
      for (int direction = 0; direction < 4; ++direction) {
        int8_t nextX = ghost.x;
        int8_t nextY = ghost.y;
        if (!move(nextX, nextY, direction)) continue;
        const int distance = (nextX > pacX_ ? nextX - pacX_ : pacX_ - nextX) +
                             (nextY > pacY_ ? nextY - pacY_ : pacY_ - nextY);
        if ((powerFrames_ == 0 && distance < bestDistance) ||
            (powerFrames_ > 0 && distance > bestDistance)) {
          bestDistance = distance;
          bestDirection = direction;
        }
      }
      if (bestDirection >= 0) {
        ghost.direction = bestDirection;
        move(ghost.x, ghost.y, bestDirection);
      }
    }
    collideWithGhosts();
  }
  bool anyPellet = false;
  for (uint8_t y = 0; y < rows; ++y) {
    for (uint8_t x = 0; x < columns; ++x) anyPellet = anyPellet || pellets_[y][x] || powerPellets_[y][x];
  }
  if (!anyPellet) {
    won_ = true;
    if (sound_) sound_->play(SoundEffect::gameStart);
  }
}

void PacMaze::render(BoardAdapter& board) const {
  board.clear(BoardAdapter::brandNavy);
  board.titleBar(BoardAdapter::brandBlue);
  board.text("PAC MAZE", 8, 10, BoardAdapter::white, 1);
  char status[24];
  std::snprintf(status, sizeof(status), "S:%u L:%u", score_, lives_);
  board.text(status, 172, 10, BoardAdapter::brandAccent, 1);
  for (uint8_t y = 0; y < rows; ++y) {
    for (uint8_t x = 0; x < columns; ++x) {
      const int px = offsetX + x * cell;
      const int py = offsetY + y * cell;
      if (maze[y][x] == '#') board.rectangle(px + 1, py + 1, cell - 2, cell - 2, BoardAdapter::brandBlue);
      else if (pellets_[y][x]) board.circle(px + cell / 2, py + cell / 2, 1, BoardAdapter::white);
      else if (powerPellets_[y][x]) board.circle(px + cell / 2, py + cell / 2, 3, BoardAdapter::yellow);
    }
  }
  const int pacCenterX = offsetX + pacX_ * cell + cell / 2;
  const int pacCenterY = offsetY + pacY_ * cell + cell / 2;
  board.circle(pacCenterX, pacCenterY, 5, BoardAdapter::yellow);
  if (currentDirection_ == 0) board.rectangle(pacCenterX - 6, pacCenterY - 2, 4, 4, BoardAdapter::brandNavy);
  else if (currentDirection_ == 1) board.rectangle(pacCenterX + 2, pacCenterY - 2, 4, 4, BoardAdapter::brandNavy);
  else if (currentDirection_ == 2) board.rectangle(pacCenterX - 2, pacCenterY - 6, 4, 4, BoardAdapter::brandNavy);
  else board.rectangle(pacCenterX - 2, pacCenterY + 2, 4, 4, BoardAdapter::brandNavy);
  for (const auto& ghost : ghosts_) drawGhost(board, ghost.x, ghost.y, ghost.color, powerFrames_ > 0);
  board.roundedRectangle(98, 236, 44, 26, 5, BoardAdapter::brandBlue);
  board.roundedRectangle(22, 270, 44, 30, 5, BoardAdapter::brandBlue);
  board.roundedRectangle(76, 270, 44, 30, 5, BoardAdapter::brandBlue);
  board.roundedRectangle(130, 270, 44, 30, 5, BoardAdapter::brandBlue);
  board.text("^", 112, 238, BoardAdapter::white, 2);
  board.text("<", 36, 274, BoardAdapter::white, 2);
  board.text("v", 90, 274, BoardAdapter::white, 2);
  board.text(">", 144, 274, BoardAdapter::white, 2);
  if (!running_ || won_) {
    board.roundedRectangle(25, 118, 190, 74, 8, BoardAdapter::brandBlue);
    board.text(won_ ? "LABYRINTH FREI" : "GAME OVER", won_ ? 39 : 62, 136, BoardAdapter::white, 2);
    board.text("Antippen: Neustart", 51, 168, BoardAdapter::brandAccent, 1);
  }
  board.present();
}
