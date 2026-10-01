#include "Core/DataStore/StartupDataChanges.h"
#include <cassert>
#include <vector>

int main()
{
    StartupDataChanges changes;
    const DataKey first = 42U;
    const DataKey last = DataKeys::ReservedMax;
    assert(changes.mark(first));
    assert(changes.mark(first)); // duplicate startup writes coalesce
    assert(changes.mark(last));

    std::vector<DataKey> sent;
    changes.drain(1U, [&sent](DataKey key) { sent.push_back(key); return true; });
    assert(sent.size() == 1U && sent[0] == first);

    // A queue refusal retains the next key for a later retry.
    changes.drain(1U, [](DataKey) { return false; });
    changes.drain(1U, [&sent](DataKey key) { sent.push_back(key); return true; });
    assert(sent.size() == 2U && sent[1] == last);
    changes.drain(1U, [](DataKey) { assert(false); return true; });
    assert(!changes.mark(first)); // startup phase has completed
}
