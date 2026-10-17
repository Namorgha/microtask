import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { StarRating } from "@/components/shared/StarRating";
import { Star, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  taskId: string;
  taskTitle: string;
  reviewerId: string;
  revieweeId: string;
  revieweeName: string;
  onDone?: () => void;
}

export function LeaveReviewDialog({ taskId, taskTitle, reviewerId, revieweeId, revieweeName, onDone }: Props) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const submit = useMutation({
    mutationFn: async () => {
      if (rating < 1 || rating > 5) throw new Error("Please choose a rating between 1 and 5.");
      const { error } = await supabase.from("reviews").insert({
        task_id: taskId,
        reviewer_id: reviewerId,
        reviewee_id: revieweeId,
        rating,
        text: text.trim() || null,
      });
      if (error) {
        if (error.code === "23505") throw new Error("You already reviewed this task.");
        if (error.code === "42501" || /row-level security/i.test(error.message)) {
          throw new Error("You can only review the other party of a completed task.");
        }
        throw error;
      }
      await supabase.from("notifications").insert({
        user_id: revieweeId,
        title: "New review",
        message: `You received a ${rating}-star review for "${taskTitle}".`,
        type: "review_received",
        data: { task_id: taskId },
      });
    },
    onSuccess: () => {
      toast({ title: "Review submitted", description: "Thanks for the feedback!" });
      setOpen(false);
      setRating(0);
      setText("");
      qc.invalidateQueries({ queryKey: ["task-review-mine", taskId] });
      qc.invalidateQueries({ queryKey: ["profile-reviews", revieweeId] });
      qc.invalidateQueries({ queryKey: ["profile", revieweeId] });
      onDone?.();
    },
    onError: (e: any) => toast({ title: "Could not submit", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full gap-2" size="lg">
          <Star className="h-4 w-4" /> Leave a review
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Review {revieweeName}</DialogTitle>
          <DialogDescription>Share an honest rating for "{taskTitle}". You can only review once.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <p className="text-sm font-medium mb-2">Your rating</p>
            <StarRating rating={rating} size="lg" interactive onRate={setRating} />
          </div>
          <div>
            <p className="text-sm font-medium mb-2">Comment <span className="text-muted-foreground font-normal">(optional)</span></p>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What went well? What could improve?"
              maxLength={1000}
              className="min-h-[100px]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submit.isPending}>Cancel</Button>
          <Button onClick={() => submit.mutate()} disabled={submit.isPending || rating < 1}>
            {submit.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Submit review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
