import { useStore } from "@/lib/store";
import { CheckSquare, Calendar, ArrowRight, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Email } from "@/types";

type Tab = "inbox" | "drafts" | "sent" | "spam" | "action_items" | "prompts" | "settings" | "chat";

type FlattenedTask = (NonNullable<Email["action_items"]>[number]) & {
    emailId: string;
    originalIndex: number;
    emailSubject: string;
    emailSender: string;
};

export function ActionItems({ setActiveTab }: { setActiveTab: (tab: Tab) => void }) {
    const { emails, setSelectedEmailId, toggleActionItem, deleteActionItem } = useStore();

    // Extract all action items from all emails
    const allTasks: FlattenedTask[] = emails.flatMap((email) =>
        (email.action_items ?? []).map((item, index) => ({
            ...item,
            emailId: email.id,
            originalIndex: index,
            emailSubject: email.subject,
            emailSender: email.sender,
        }))
    );

    // Sort by deadline (simple string comparison for now, ideally parse dates)
    const sortedTasks = [...allTasks].sort((a, b) => {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return a.deadline.localeCompare(b.deadline);
    });

    return (
        <div className="p-8 h-full overflow-y-auto bg-gray-50/50 w-full">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-3 bg-orange-100 text-orange-600 rounded-xl">
                        <CheckSquare className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-gray-500">Your consolidated to-do list from all emails.</p>
                    </div>
                </div>

                {sortedTasks.length === 0 ? (
                    <div className="bg-white rounded-2xl p-12 text-center border border-gray-200 shadow-sm">
                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckSquare className="w-8 h-8" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">All Caught Up!</h3>
                        <p className="text-gray-500">No action items found in your inbox.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {sortedTasks.map((task, idx) => (
                            <div
                                key={idx}
                                className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all group"
                            >
                                <div className="flex items-start gap-4">
                                    <div className="mt-1">
                                        <div
                                            onClick={() => {
                                                toggleActionItem(task.emailId, task.originalIndex);
                                            }}
                                            className={cn(
                                                "w-5 h-5 border-2 rounded-md transition-colors cursor-pointer flex items-center justify-center",
                                                task.completed ? "bg-blue-500 border-blue-500" : "border-gray-300 group-hover:border-blue-500"
                                            )}
                                        >
                                            {task.completed && <CheckSquare className="w-3 h-3 text-white" />}
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-gray-900 text-lg mb-1">{task.task}</h3>
                                        <div className="flex items-center gap-4 text-sm text-gray-500">
                                            {task.deadline && (
                                                <span className="flex items-center gap-1 text-orange-600 font-medium bg-orange-50 px-2 py-0.5 rounded">
                                                    <Calendar className="w-3 h-3" /> Due: {task.deadline}
                                                </span>
                                            )}
                                            <span className="flex items-center gap-1">
                                                From: {task.emailSender}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => {
                                                if (confirm("Are you sure you want to delete this action item?")) {
                                                    deleteActionItem(task.emailId, task.originalIndex);
                                                }
                                            }}
                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                                            title="Delete action item"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => {
                                                // Navigate to the source email
                                                setSelectedEmailId(task.emailId);
                                                // Switch to inbox tab to show the email
                                                setActiveTab("inbox");
                                            }}
                                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors shrink-0"
                                            title="Go to source email"
                                        >
                                            <ArrowRight className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
