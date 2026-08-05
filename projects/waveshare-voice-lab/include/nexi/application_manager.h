#pragma once

#include <cstddef>

#include "nexi/application.h"
#include "nexi/input_provider.h"

namespace nexi {

// Fixed capacities make memory use deterministic on the ESP32-S3. The manager
// stores non-owning pointers; applications and providers outlive the manager.
class ApplicationManager {
 public:
  static constexpr size_t kMaxApplications = 8;
  static constexpr size_t kMaxInputProviders = 4;

  ApplicationManager();

  bool registerApplication(Application* application);
  bool registerInputProvider(InputProvider* provider);

  bool dispatch(const Intent& intent);
  void tick();
  void stopActive(ApplicationStopReason reason);

  Application* activeApplication() const;
  ApplicationId activeApplicationId() const;
  size_t applicationCount() const;
  size_t inputProviderCount() const;

 private:
  Application* findApplication(ApplicationId id) const;
  bool activate(const Intent& trigger);

  Application* applications_[kMaxApplications];
  InputProvider* inputProviders_[kMaxInputProviders];
  size_t applicationCount_;
  size_t inputProviderCount_;
  Application* activeApplication_;
};

}  // namespace nexi
