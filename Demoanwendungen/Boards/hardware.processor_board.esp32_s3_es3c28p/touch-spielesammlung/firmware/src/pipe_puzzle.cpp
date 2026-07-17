#include "pipe_puzzle.h"
#include "sound_driver.h"
#include <cstdio>
namespace {
constexpr uint8_t n=1,e=2,s=4,w=8; constexpr int cell=32,x0=24,y0=42;
constexpr uint8_t solution[36]={e,e|w,e|w,e|w,e|w,s|w,e|s,e|w,e|w,e|w,e|w,n|w,n|e,e|w,e|w,e|w,e|w,s|w,e|s,e|w,e|w,e|w,e|w,n|w,n|e,e|w,e|w,e|w,e|w,s|w,n,e|w,e|w,e|w,e|w,n|w};
constexpr uint8_t turns[36]={2,1,3,2,1,3,1,2,3,1,2,3,3,1,2,3,1,2,2,3,1,2,3,1,1,3,2,1,3,2,3,2,1,3,2,1};
uint8_t opposite(uint8_t d){return d==n?s:(d==e?w:(d==s?n:e));}
}
uint8_t PipePuzzle::rotate(uint8_t c) const { uint8_t r=0; if(c&n)r|=e; if(c&e)r|=s; if(c&s)r|=w; if(c&w)r|=n; return r; }
void PipePuzzle::reset(SoundDriver& sound){ sound_=&sound;moves_=0;solved_=false;for(uint8_t i=0;i<36;++i){tiles_[i]=solution[i];for(uint8_t t=0;t<turns[i];++t)tiles_[i]=rotate(tiles_[i]);}sound_->play(SoundEffect::gameStart); }
bool PipePuzzle::solvedPath() const { bool seen[36]={};uint8_t q[36]={},head=0,tail=0;q[tail++]=0;seen[0]=true;while(head<tail){uint8_t i=q[head++],row=i/size,col=i%size;const uint8_t dirs[4]={n,e,s,w};for(uint8_t d:dirs){if(!(tiles_[i]&d))continue;int rr=row,cc=col;if(d==n)--rr;else if(d==e)++cc;else if(d==s)++rr;else --cc;if(rr<0||cc<0||rr>=size||cc>=size)continue;uint8_t j=rr*size+cc;if(!seen[j]&&(tiles_[j]&opposite(d))){seen[j]=true;q[tail++]=j;}}}for(bool value:seen)if(!value)return false;return true; }
void PipePuzzle::touch(const TouchPoint& point){if(solved_){if(sound_)reset(*sound_);return;}int col=(point.x-x0)/cell,row=(point.y-y0)/cell;if(col<0||row<0||col>=size||row>=size)return;uint8_t i=row*size+col;tiles_[i]=rotate(tiles_[i]);++moves_;if(sound_)sound_->play(SoundEffect::move);if(solvedPath()){solved_=true;if(sound_)sound_->play(SoundEffect::gameStart);}}
void PipePuzzle::tick(){}
void PipePuzzle::render(BoardAdapter& b) const {b.clear(BoardAdapter::brandNavy);b.titleBar(BoardAdapter::brandBlue);b.text("PIPE PUZZLE",8,10,BoardAdapter::white,1);char st[18];std::snprintf(st,sizeof(st),"ZUEGE:%u",moves_);b.text(st,166,10,BoardAdapter::brandAccent,1);b.text("START",2,48,BoardAdapter::green,1);b.text("ZIEL",2,208,BoardAdapter::yellow,1);for(uint8_t r=0;r<size;++r)for(uint8_t c=0;c<size;++c){int x=x0+c*cell,y=y0+r*cell,cx=x+16,cy=y+16;uint8_t p=tiles_[r*size+c];b.rectangle(x+1,y+1,30,30,BoardAdapter::brandBlue);if(p&n)b.line(cx,cy,cx,y+3,BoardAdapter::brandAccent);if(p&e)b.line(cx,cy,x+29,cy,BoardAdapter::brandAccent);if(p&s)b.line(cx,cy,cx,y+29,BoardAdapter::brandAccent);if(p&w)b.line(cx,cy,x+3,cy,BoardAdapter::brandAccent);b.circle(cx,cy,3,BoardAdapter::brandAccent);}b.line(2,58,27,58,BoardAdapter::green);b.line(2,218,27,218,BoardAdapter::yellow);b.text("Kachel antippen = drehen",42,242,BoardAdapter::white,1);if(solved_){b.roundedRectangle(24,110,192,66,8,BoardAdapter::brandBlue);b.text("LEITUNG LAEUFT!",41,126,BoardAdapter::white,2);b.text("Antippen: Neues Puzzle",43,158,BoardAdapter::brandAccent,1);}b.present();}
