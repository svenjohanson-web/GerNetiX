#include "nexi/intent.h"

namespace nexi {

Intent Intent::create(IntentType type, IntentSource source, int32_t value,
    uint8_t confidence) {
  return Intent{type, source, ApplicationId::Count, value, confidence};
}

Intent Intent::selectApplication(ApplicationId application, IntentSource source,
    uint8_t confidence) {
  return Intent{
      IntentType::SelectApplication, source, application, 0, confidence};
}

}  // namespace nexi
