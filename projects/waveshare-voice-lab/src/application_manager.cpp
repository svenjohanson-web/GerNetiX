#include "nexi/application_manager.h"

namespace nexi {

ApplicationManager::ApplicationManager()
    : applications_{},
      inputProviders_{},
      applicationCount_(0),
      inputProviderCount_(0),
      activeApplication_(nullptr) {}

bool ApplicationManager::registerApplication(Application* application) {
  if (application == nullptr || application->id() == ApplicationId::Count ||
      applicationCount_ >= kMaxApplications ||
      findApplication(application->id()) != nullptr) {
    return false;
  }

  applications_[applicationCount_++] = application;
  return true;
}

bool ApplicationManager::registerInputProvider(InputProvider* provider) {
  if (provider == nullptr || inputProviderCount_ >= kMaxInputProviders) {
    return false;
  }
  for (size_t index = 0; index < inputProviderCount_; ++index) {
    if (inputProviders_[index] == provider) {
      return false;
    }
  }

  inputProviders_[inputProviderCount_++] = provider;
  return true;
}

bool ApplicationManager::dispatch(const Intent& intent) {
  switch (intent.type) {
    case IntentType::None:
      return false;
    case IntentType::SelectApplication:
      return activate(intent);
    case IntentType::StopApplication:
      if (activeApplication_ == nullptr) {
        return false;
      }
      stopActive(ApplicationStopReason::UserRequest);
      return true;
    default:
      if (activeApplication_ == nullptr) {
        return false;
      }
      activeApplication_->handleIntent(intent);
      return true;
  }
}

void ApplicationManager::tick() {
  for (size_t index = 0; index < inputProviderCount_; ++index) {
    Intent intent = Intent::create(IntentType::None);
    if (inputProviders_[index]->poll(&intent)) {
      dispatch(intent);
    }
  }

  if (activeApplication_ != nullptr) {
    activeApplication_->tick();
  }
}

void ApplicationManager::stopActive(ApplicationStopReason reason) {
  if (activeApplication_ == nullptr) {
    return;
  }

  Application* stoppedApplication = activeApplication_;
  activeApplication_ = nullptr;
  stoppedApplication->stop(reason);
}

Application* ApplicationManager::activeApplication() const {
  return activeApplication_;
}

ApplicationId ApplicationManager::activeApplicationId() const {
  return activeApplication_ == nullptr ? ApplicationId::Count
                                       : activeApplication_->id();
}

size_t ApplicationManager::applicationCount() const {
  return applicationCount_;
}

size_t ApplicationManager::inputProviderCount() const {
  return inputProviderCount_;
}

Application* ApplicationManager::findApplication(ApplicationId id) const {
  for (size_t index = 0; index < applicationCount_; ++index) {
    if (applications_[index]->id() == id) {
      return applications_[index];
    }
  }
  return nullptr;
}

bool ApplicationManager::activate(const Intent& trigger) {
  Application* requestedApplication = findApplication(trigger.application);
  if (requestedApplication == nullptr) {
    return false;
  }
  if (requestedApplication == activeApplication_) {
    activeApplication_->handleIntent(trigger);
    return true;
  }

  stopActive(ApplicationStopReason::ApplicationSwitch);
  if (!requestedApplication->start(trigger)) {
    return false;
  }

  activeApplication_ = requestedApplication;
  return true;
}

}  // namespace nexi
