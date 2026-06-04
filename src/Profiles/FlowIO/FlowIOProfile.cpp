#include "Profiles/FlowIO/FlowIOProfile.h"

#include "Board/BoardCatalog.h"
#include "Core/FirmwareVersion.h"
#include "Domain/DomainCatalog.h"

namespace Profiles {
namespace FlowIO {

const FirmwareProfile& profile()
{
    static const FirmwareProfile kProfile{
        "flow.io",
        &BoardCatalog::activeBoard(),
        &DomainCatalog::pool(),
        {
            "flow.io",
            "flowio",
            FirmwareVersion::Full,
            "rt"
        },
        nullptr,
        setupProfile,
        loopProfile
    };
    return kProfile;
}

}  // namespace FlowIO
}  // namespace Profiles
